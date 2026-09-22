import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { toast } from "sonner";
import { server } from "@/test-helpers/msw-server";
import type { SraValidationOutcome } from "@/lib/services/sra-validation";
import type { Library } from "@/types/services";
import SraRunAccessionWithValidation from "../sra-run-accession-with-validation";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

/**
 * Lets a test replace the transport for the duration of that test. Most tests
 * leave this null and drive the real transport through MSW; the staleness
 * tests install a stub that deliberately ignores the abort signal, so the
 * component's request-id guard — not the abort — is what has to reject the
 * superseded response.
 */
const transport = vi.hoisted(() => ({
  override: null as
    | ((accession: string, signal?: AbortSignal) => Promise<SraValidationOutcome>)
    | null,
}));

vi.mock("@/lib/services/sra-validation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/services/sra-validation")>();
  return {
    ...actual,
    requestSraValidation: (accession: string, signal?: AbortSignal) =>
      transport.override
        ? transport.override(accession, signal)
        : actual.requestSraValidation(accession, signal),
  };
});

const validationDebounceMs = 500;

function xmlForRuns(runs: string[], studyTitle = "A study"): string {
  const runXml = runs
    .map((run) => `<RUN accession="${run}" />`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<EXPERIMENT_PACKAGE_SET>
  <EXPERIMENT_PACKAGE>
    <EXPERIMENT accession="SRX000001" />
    <STUDY><DESCRIPTOR><STUDY_TITLE>${studyTitle}</STUDY_TITLE></DESCRIPTOR></STUDY>
    <RUN_SET>${runXml}</RUN_SET>
  </EXPERIMENT_PACKAGE>
</EXPERIMENT_PACKAGE_SET>`;
}

/** A promise plus its resolver, used to hold a response open mid-test. */
function deferred() {
  let release: () => void = () => {
    throw new Error("deferred released before it was initialized");
  };
  const promise = new Promise<null>((resolve) => {
    release = () => {
      resolve(null);
    };
  });
  return { promise, release: () => { release(); } };
}

/** Resolves every validation request with the XML for `runs[accession]`. */
function respondWithRuns(
  runsByAccession: Record<string, string[] | undefined>,
) {
  server.use(
    http.get("/api/services/sra-validation", ({ request }) => {
      const accession =
        new URL(request.url).searchParams.get("accession") ?? "";
      const runs = runsByAccession[accession];
      if (!runs) {
        return HttpResponse.json(
          { error: `Accession ${accession} is not valid` },
          { status: 400 },
        );
      }
      return HttpResponse.json({ success: true, xml: xmlForRuns(runs) });
    }),
  );
}

interface HarnessProps {
  initialLibraries?: Library[];
  allowDuplicates?: boolean;
  showLabel?: boolean;
  showAddButton?: boolean;
  defaultValue?: string;
  onAdd?: (srrIds: string[], title?: string) => void;
  onChange?: (value: string) => void;
}

/**
 * Mirrors how service pages use the component: `selectedLibraries` is owned by
 * the parent, so `setSelectedLibraries` actually re-renders with new state.
 */
function Harness({
  initialLibraries = [],
  allowDuplicates,
  showLabel,
  showAddButton,
  defaultValue,
  onAdd,
  onChange,
}: HarnessProps) {
  const [libraries, setLibraries] = React.useState<Library[]>(initialLibraries);
  return (
    <div>
      <SraRunAccessionWithValidation
        selectedLibraries={libraries}
        setSelectedLibraries={setLibraries}
        allowDuplicates={allowDuplicates}
        showLabel={showLabel}
        showAddButton={showAddButton}
        defaultValue={defaultValue}
        onAdd={onAdd}
        onChange={onChange}
      />
      <ul data-testid="libraries">
        {libraries.map((library) => (
          <li key={library.id}>{library.id}</li>
        ))}
      </ul>
    </div>
  );
}

function input() {
  return screen.getByPlaceholderText("SRR...");
}

function addButton() {
  return screen.getByRole("button", {
    name: "Add SRA run accession to selected libraries",
  });
}

function libraryIds(): string[] {
  return Array.from(
    screen.getByTestId("libraries").querySelectorAll("li"),
  ).map((node) => node.textContent);
}

/** Types into the input and lets the debounce timer fire. */
async function typeAndSettleDebounce(value: string) {
  fireEvent.change(input(), { target: { value } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(validationDebounceMs);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  transport.override = null;
  vi.useRealTimers();
});

describe("SraRunAccessionWithValidation", () => {
  it("adds a single run on manual add and clears the input", async () => {
    respondWithRuns({ SRR100: ["SRR100"] });
    const onAdd = vi.fn();
    const onChange = vi.fn();
    render(<Harness onAdd={onAdd} onChange={onChange} />);

    await typeAndSettleDebounce("SRR100");
    await waitFor(() => {
      expect(screen.getByText("Provided SRA is valid")).toBeInTheDocument();
    });

    fireEvent.click(addButton());

    await waitFor(() => {
      expect(libraryIds()).toEqual(["SRR100"]);
    });
    expect(onAdd).toHaveBeenCalledWith(["SRR100"]);
    expect(input()).toHaveValue("");
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("adds every run of a multi-run experiment with the study title", async () => {
    respondWithRuns({ SRX200: ["SRR201", "SRR202"] });
    const onAdd = vi.fn();
    render(<Harness onAdd={onAdd} />);

    await typeAndSettleDebounce("SRX200");
    await waitFor(() => {
      expect(screen.getByText("Provided SRA is valid")).toBeInTheDocument();
    });
    fireEvent.click(addButton());

    await waitFor(() => {
      expect(libraryIds()).toEqual(["SRR201", "SRR202"]);
    });
    expect(onAdd).toHaveBeenCalledWith(["SRR201", "SRR202"], "A study");
  });

  it("accepts a backend timeout as a single valid run", async () => {
    server.use(
      http.get("/api/services/sra-validation", () =>
        HttpResponse.json({ success: true, timeout: true }),
      ),
    );
    const onAdd = vi.fn();
    render(<Harness onAdd={onAdd} />);

    await typeAndSettleDebounce("SRR300");
    await waitFor(() => {
      expect(screen.getByText("Timeout exceeded.")).toBeInTheDocument();
    });

    fireEvent.click(addButton());
    await waitFor(() => {
      expect(libraryIds()).toEqual(["SRR300"]);
    });
    expect(onAdd).toHaveBeenCalledWith(["SRR300"]);
  });

  it("rejects a malformed accession without contacting the backend", async () => {
    // No MSW handler registered: a request would fail the suite outright.
    render(<Harness />);

    await typeAndSettleDebounce("not-an-accession");

    await waitFor(() => {
      expect(
        screen.getByText("Your input is not valid. Hint: only one SRR at a time."),
      ).toBeInTheDocument();
    });
  });

  it("surfaces the backend error message verbatim, stripped of markup", async () => {
    server.use(
      http.get("/api/services/sra-validation", () =>
        HttpResponse.json(
          { error: "<b>Accession SRR400 is not valid</b>" },
          { status: 400 },
        ),
      ),
    );
    render(<Harness />);

    await typeAndSettleDebounce("SRR400");

    await waitFor(() => {
      expect(
        screen.getByText("Accession SRR400 is not valid"),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("Provided SRA is valid")).not.toBeInTheDocument();
  });

  it("reports a record that parses but contains no runs", async () => {
    server.use(
      http.get("/api/services/sra-validation", () =>
        HttpResponse.json({
          success: true,
          xml: "<EXPERIMENT_PACKAGE_SET></EXPERIMENT_PACKAGE_SET>",
        }),
      ),
    );
    render(<Harness />);

    await typeAndSettleDebounce("SRX500");

    await waitFor(() => {
      expect(
        screen.getByText("The accession is not a run id."),
      ).toBeInTheDocument();
    });
  });

  describe("duplicate handling", () => {
    it("adds nothing when a single-run accession is already selected", async () => {
      respondWithRuns({ SRR100: ["SRR100"] });
      const onAdd = vi.fn();
      render(
        <Harness
          initialLibraries={[{ id: "SRR100", name: "SRR100", type: "sra" }]}
          onAdd={onAdd}
        />,
      );

      await typeAndSettleDebounce("SRR100");
      await waitFor(() => {
        expect(screen.getByText("Provided SRA is valid")).toBeInTheDocument();
      });
      fireEvent.click(addButton());

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Duplicate SRA accession detected",
          expect.objectContaining({
            description: "SRA accession SRR100 has already been added.",
          }),
        );
      });
      expect(libraryIds()).toEqual(["SRR100"]);
      expect(onAdd).not.toHaveBeenCalled();
      // Asymmetric with the multi-run branch: nothing is added, and the input
      // is left intact for the user to correct.
      expect(input()).toHaveValue("SRR100");
    });

    it("skips duplicate runs but still adds the rest of a multi-run result", async () => {
      respondWithRuns({ SRX200: ["SRR201", "SRR202"] });
      const onAdd = vi.fn();
      render(
        <Harness
          initialLibraries={[{ id: "SRR201", name: "SRR201", type: "sra" }]}
          onAdd={onAdd}
        />,
      );

      await typeAndSettleDebounce("SRX200");
      await waitFor(() => {
        expect(screen.getByText("Provided SRA is valid")).toBeInTheDocument();
      });
      fireEvent.click(addButton());

      await waitFor(() => {
        expect(libraryIds()).toEqual(["SRR201", "SRR202"]);
      });
      expect(toast.error).toHaveBeenCalledWith(
        "Duplicate SRA accession detected",
        expect.objectContaining({
          description: "SRA accession SRR201 has already been added.",
        }),
      );
      expect(onAdd).toHaveBeenCalledWith(["SRR201", "SRR202"], "A study");
    });

    it("re-adds a duplicate when allowDuplicates is set", async () => {
      respondWithRuns({ SRR100: ["SRR100"] });
      render(
        <Harness
          allowDuplicates
          initialLibraries={[{ id: "SRR100", name: "SRR100", type: "sra" }]}
        />,
      );

      await typeAndSettleDebounce("SRR100");
      await waitFor(() => {
        expect(screen.getByText("Provided SRA is valid")).toBeInTheDocument();
      });
      fireEvent.click(addButton());

      await waitFor(() => {
        expect(libraryIds()).toEqual(["SRR100", "SRR100"]);
      });
      expect(toast.error).not.toHaveBeenCalled();
    });
  });

  describe("automatic addition (showAddButton=false)", () => {
    it("adds the validated runs without an explicit add action", async () => {
      respondWithRuns({ SRX200: ["SRR201", "SRR202"] });
      const onAdd = vi.fn();
      render(<Harness showAddButton={false} onAdd={onAdd} />);

      await typeAndSettleDebounce("SRX200");

      await waitFor(() => {
        expect(libraryIds()).toEqual(["SRR201", "SRR202"]);
      });
      expect(onAdd).toHaveBeenCalledWith(["SRR201", "SRR202"], "A study");
      // skipClear: the input keeps the accession the user typed.
      expect(input()).toHaveValue("SRX200");
      expect(
        screen.queryByRole("button", {
          name: "Add SRA run accession to selected libraries",
        }),
      ).not.toBeInTheDocument();
    });

    it("does not re-add runs that are already selected", async () => {
      respondWithRuns({ SRX200: ["SRR201", "SRR202"] });
      const onAdd = vi.fn();
      render(
        <Harness
          showAddButton={false}
          onAdd={onAdd}
          initialLibraries={[
            { id: "SRR201", name: "SRR201", type: "sra" },
            { id: "SRR202", name: "SRR202", type: "sra" },
          ]}
        />,
      );

      await typeAndSettleDebounce("SRX200");
      await waitFor(() => {
        expect(screen.getByText("Provided SRA is valid")).toBeInTheDocument();
      });

      expect(libraryIds()).toEqual(["SRR201", "SRR202"]);
      expect(onAdd).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("validates and adds a defaultValue on mount", async () => {
      respondWithRuns({ SRR600: ["SRR600"] });
      const onAdd = vi.fn();
      render(
        <Harness showAddButton={false} defaultValue="SRR600" onAdd={onAdd} />,
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(validationDebounceMs);
      });

      await waitFor(() => {
        expect(libraryIds()).toEqual(["SRR600"]);
      });
      expect(onAdd).toHaveBeenCalledWith(["SRR600"]);
      expect(input()).toHaveValue("SRR600");
    });

    it("adds on Enter when no add button is rendered", async () => {
      respondWithRuns({ SRR700: ["SRR700"] });
      const onAdd = vi.fn();
      render(<Harness showAddButton={false} onAdd={onAdd} />);

      fireEvent.change(input(), { target: { value: "SRR700" } });
      fireEvent.keyDown(input(), { key: "Enter" });

      await waitFor(() => {
        expect(libraryIds()).toEqual(["SRR700"]);
      });
      // Enter goes through handleAdd, which clears the input.
      expect(input()).toHaveValue("");
      expect(onAdd).toHaveBeenCalledTimes(1);
    });
  });

  describe("presentation", () => {
    const addButtonName = "Add SRA run accession to selected libraries";

    it.each([
      { showLabel: true, showAddButton: true },
      { showLabel: true, showAddButton: false },
      { showLabel: false, showAddButton: true },
      { showLabel: false, showAddButton: false },
    ])(
      "renders label=$showLabel addButton=$showAddButton",
      ({ showLabel, showAddButton }) => {
        render(<Harness showLabel={showLabel} showAddButton={showAddButton} />);

        expect(screen.queryByText("SRA Run Accession") !== null).toBe(
          showLabel,
        );
        expect(
          screen.queryByRole("button", { name: addButtonName }) !== null,
        ).toBe(showAddButton);
        expect(input()).toBeInTheDocument();
      },
    );

    it("disables the add button until an accession is entered", () => {
      render(<Harness />);
      expect(addButton()).toBeDisabled();

      fireEvent.change(input(), { target: { value: "SRR100" } });
      expect(addButton()).toBeEnabled();
    });

    it("styles the in-progress message as muted and a failure as destructive", async () => {
      const held = deferred();
      transport.override = async () => {
        await held.promise;
        return { status: "error", message: "Validating is not a real result" };
      };
      render(<Harness />);

      fireEvent.change(input(), { target: { value: "SRR100" } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(validationDebounceMs);
      });

      expect(screen.getByText("Validating SRR100...")).toHaveClass(
        "text-muted-foreground",
      );

      held.release();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });

      // Styling comes from validationStatus, not from matching the message
      // text, so a settled message that happens to contain "Validating" still
      // reads as an error.
      expect(
        screen.getByText("Validating is not a real result"),
      ).toHaveClass("text-destructive");
    });
  });

  describe("stale responses", () => {
    /**
     * Installs a transport that holds the named accession's response open and
     * deliberately ignores `signal`. Aborting therefore cannot be what saves
     * the component — only the request-id guard can reject the stale outcome.
     */
    function holdTransport(
      heldAccession: string,
      outcomes: Record<string, SraValidationOutcome | undefined>,
    ) {
      const held = deferred();
      transport.override = async (accession) => {
        if (accession === heldAccession) await held.promise;
        return (
          outcomes[accession] ?? {
            status: "error" as const,
            message: `Accession ${accession} is not valid`,
          }
        );
      };
      return held;
    }

    it("ignores an older response that resolves after a newer one", async () => {
      const releaseFirst = holdTransport("SRR801", {
        SRR801: {
          status: "valid",
          result: { runs: ["SRR801"], title: "Stale study" },
        },
      });
      render(<Harness showAddButton={false} />);

      // First accession: request starts but is held open.
      await typeAndSettleDebounce("SRR801");
      // Second accession supersedes it before the first response lands.
      await typeAndSettleDebounce("SRR802");
      await waitFor(() => {
        expect(
          screen.getByText("Accession SRR802 is not valid"),
        ).toBeInTheDocument();
      });

      // Now let the stale first response resolve.
      releaseFirst.release();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });

      // The stale success must not overwrite the newer failure, mark the
      // field valid, or auto-add its run.
      expect(
        screen.getByText("Accession SRR802 is not valid"),
      ).toBeInTheDocument();
      expect(screen.queryByText("Provided SRA is valid")).not.toBeInTheDocument();
      expect(libraryIds()).toEqual([]);
    });

    // Locks in that manual add keys off the accession currently in the input.
    // The cache is keyed by accession, so a late outcome for an older one can
    // never be read back — this asserts that property rather than the guard.
    it("manual add uses the newest validated result, not an older in-flight one", async () => {
      const releaseFirst = holdTransport("SRR901", {
        SRR901: { status: "valid", result: { runs: ["SRR901"], title: "" } },
        SRR902: { status: "valid", result: { runs: ["SRR902"], title: "" } },
      });
      const onAdd = vi.fn();
      render(<Harness onAdd={onAdd} />);

      await typeAndSettleDebounce("SRR901");
      await typeAndSettleDebounce("SRR902");
      await waitFor(() => {
        expect(screen.getByText("Provided SRA is valid")).toBeInTheDocument();
      });

      releaseFirst.release();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });

      fireEvent.click(addButton());
      await waitFor(() => {
        expect(libraryIds()).toEqual(["SRR902"]);
      });
      expect(onAdd).toHaveBeenCalledWith(["SRR902"]);
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    it("does not let a stale timeout outcome mark a newer input valid", async () => {
      const releaseFirst = holdTransport("SRR910", {
        SRR910: {
          status: "timeout",
          result: { runs: ["SRR910"], title: "" },
        },
        SRR911: { status: "not-run" },
      });
      render(<Harness showAddButton={false} />);

      await typeAndSettleDebounce("SRR910");
      await typeAndSettleDebounce("SRR911");
      await waitFor(() => {
        expect(
          screen.getByText("The accession is not a run id."),
        ).toBeInTheDocument();
      });

      releaseFirst.release();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });

      expect(
        screen.getByText("The accession is not a run id."),
      ).toBeInTheDocument();
      expect(screen.queryByText("Timeout exceeded.")).not.toBeInTheDocument();
      expect(libraryIds()).toEqual([]);
    });

    it("clears validation state when the input is emptied mid-flight", async () => {
      const release = holdTransport("SRR950", {
        SRR950: { status: "valid", result: { runs: ["SRR950"], title: "" } },
      });
      render(<Harness showAddButton={false} />);

      await typeAndSettleDebounce("SRR950");
      fireEvent.change(input(), { target: { value: "" } });

      release.release();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(validationDebounceMs + 50);
      });

      expect(screen.queryByText("Provided SRA is valid")).not.toBeInTheDocument();
      expect(screen.queryByText(/Validating/)).not.toBeInTheDocument();
      expect(libraryIds()).toEqual([]);
    });

    it("does not update state after unmount", async () => {
      const release = holdTransport("SRR960", {
        SRR960: { status: "valid", result: { runs: ["SRR960"], title: "" } },
      });
      const onAdd = vi.fn();
      const { unmount } = render(
        <Harness showAddButton={false} onAdd={onAdd} />,
      );

      await typeAndSettleDebounce("SRR960");
      unmount();

      release.release();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });

      expect(onAdd).not.toHaveBeenCalled();
    });
  });
});
