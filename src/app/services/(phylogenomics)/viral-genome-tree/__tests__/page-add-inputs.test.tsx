import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { toast } from "sonner";

import ViralGenomeTreePage from "../page";
import { server } from "@/test-helpers/msw-server";

const { pickedPaths } = vi.hoisted(() => {
  const pickedPaths: Record<string, string> = {
    genomeGroup: "/testuser@bvbrc/home/Genome Groups/Influenza",
    alignedDnaFastaOrContigs: "/testuser@bvbrc/home/fasta/aligned.fasta",
    featureDnaFasta: "/testuser@bvbrc/home/fasta/unaligned.fasta",
  };
  return { pickedPaths };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/hooks/services/use-service-runtime", () => ({
  useServiceRuntime: () => ({ isSubmitting: false, jobParamsDialogProps: {} }),
}));

vi.mock("@/components/services/job-params-dialog", () => ({
  JobParamsDialog: () => null,
}));

vi.mock("@/components/services/service-header", () => ({
  ServiceHeader: () => null,
}));

vi.mock("@/components/services/output-folder", () => ({
  default: () => null,
}));

// A button per picker that selects that picker's fixed path.
vi.mock("@/components/workspace/workspace-object-selector", () => ({
  WorkspaceObjectSelector: ({
    preset,
    onSelectedObjectChange,
  }: {
    preset: string;
    onSelectedObjectChange: (object: {
      id: string;
      name: string;
      type: string;
      path: string;
      isDirectory: boolean;
    }) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        const path = pickedPaths[preset];
        onSelectedObjectChange({
          id: path,
          name: path.split("/").pop() ?? path,
          type: preset,
          path,
          isDirectory: false,
        });
      }}
    >
      Pick {preset}
    </button>
  ),
}));

const groupPath = pickedPaths.genomeGroup;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function serveGroup(genomeId: unknown, gate?: Promise<void>) {
  server.use(
    http.post("*/api/services/workspace", async () => {
      await gate;
      return HttpResponse.json({
        result: [
          [
            [
              ["Influenza", "genome_group", "/testuser@bvbrc/home/Genome Groups/"],
              JSON.stringify({ id_list: { genome_id: genomeId } }),
            ],
          ],
        ],
      });
    }),
  );
}

function serveValidation(
  results: {
    genome_id: string;
    superkingdom: string;
    contigs: number;
    genome_length: number;
  }[],
) {
  server.use(
    http.post("*/api/services/genome/validate-viral", () =>
      HttpResponse.json({ results }),
    ),
  );
}

function addButton(name: string) {
  return screen.getByRole("button", { name });
}

async function pickAndAddGroup(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Pick genomeGroup" }));
  await user.click(addButton("Add genome group"));
}

/** The selected-sequences table row whose path is `path`. */
async function findSelectedRow(path: string) {
  const row = (await screen.findByText(path)).closest("tr");
  if (!row) throw new Error(`No selected-sequences row for ${path}`);
  return row;
}

/** The genome group button is back on its plus icon and can be used again. */
async function expectGroupButtonSettled() {
  await waitFor(() => {
    expect(addButton("Add genome group")).toBeEnabled();
  });
  expect(
    within(addButton("Add genome group")).queryByRole("status", {
      name: "Loading",
    }),
  ).toBeNull();
}

describe("ViralGenomeTreePage add inputs", () => {
  it("keeps every add button disabled until something is picked", () => {
    render(<ViralGenomeTreePage />);

    expect(addButton("Add genome group")).toBeDisabled();
    expect(addButton("Add aligned sequence")).toBeDisabled();
    expect(addButton("Add unaligned sequence")).toBeDisabled();
  });

  it("shows a spinner while validating and returns to the plus after an invalid group", async () => {
    const gate = deferred();
    serveGroup("83332.12,511145.12", gate.promise);
    serveValidation([
      {
        genome_id: "83332.12",
        superkingdom: "Bacteria",
        contigs: 1,
        genome_length: 4411532,
      },
      {
        genome_id: "511145.12",
        superkingdom: "Bacteria",
        contigs: 1,
        genome_length: 4641652,
      },
    ]);
    const user = userEvent.setup();
    render(<ViralGenomeTreePage />);
    await user.click(screen.getByRole("button", { name: "Pick alignedDnaFastaOrContigs" }));

    await pickAndAddGroup(user);

    expect(
      within(addButton("Add genome group")).getByRole("status", {
        name: "Loading",
      }),
    ).toBeInTheDocument();
    expect(addButton("Add genome group")).toBeDisabled();
    expect(addButton("Add aligned sequence")).toBeDisabled();

    act(() => {
      gate.resolve();
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledTimes(1);
    });
    expect(toast.error).toHaveBeenCalledWith(
      "Genome group validation failed",
      expect.objectContaining({
        description:
          "This looks like an invalid genome group. The following errors were found:\n" +
          "- Invalid Superkingdom: only virus genomes are permitted\n" +
          "First occurrence for genome_id: 83332.12\n" +
          "- Error: genome exceeds maximum length 250000\n" +
          "First occurrence for genome_id: 83332.12",
      }),
    );
    await expectGroupButtonSettled();
    expect(addButton("Add aligned sequence")).toBeEnabled();
    expect(screen.queryByText(groupPath)).not.toBeInTheDocument();
  });

  it("shows the workspace error and returns to the plus when the group cannot be read", async () => {
    server.use(
      http.post("*/api/services/workspace", () =>
        HttpResponse.json({ error: "Object not found" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    render(<ViralGenomeTreePage />);

    await pickAndAddGroup(user);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Validation error",
        expect.objectContaining({ description: "Object not found" }),
      );
    });
    expect(toast.error).toHaveBeenCalledTimes(1);
    await expectGroupButtonSettled();
  });

  it("lists a valid group and clears its picker", async () => {
    serveGroup(["11320.1", "11320.2"]);
    serveValidation(
      ["11320.1", "11320.2"].map((genomeId) => ({
        genome_id: genomeId,
        superkingdom: "Viruses",
        contigs: 1,
        genome_length: 13588,
      })),
    );
    const user = userEvent.setup();
    render(<ViralGenomeTreePage />);

    await pickAndAddGroup(user);

    // The Type cell; the narrow layout's copy under the path is hidden by a
    // container query jsdom does not apply.
    expect(
      within(await findSelectedRow(groupPath)).getByRole("cell", {
        name: "Genome Group",
      }),
    ).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith(
      "Genome group added",
      expect.objectContaining({
        description: "Added genome group with 2 genomes.",
      }),
    );
    expect(toast.error).not.toHaveBeenCalled();
    // The picker was cleared, so the button waits for a new selection.
    expect(addButton("Add genome group")).toBeDisabled();
  });

  // The hook test pins the stale-response guard by awaiting the add itself;
  // this one checks that the page's Reset button reaches it.
  it("drops a group that is still validating when Reset is pressed", async () => {
    const gate = deferred();
    let responded = false;
    serveGroup(
      ["11320.1"],
      gate.promise.then(() => {
        responded = true;
      }),
    );
    serveValidation([
      {
        genome_id: "11320.1",
        superkingdom: "Viruses",
        contigs: 1,
        genome_length: 13588,
      },
    ]);
    const user = userEvent.setup();
    render(<ViralGenomeTreePage />);

    await pickAndAddGroup(user);
    expect(
      within(addButton("Add genome group")).getByRole("status", {
        name: "Loading",
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(
      within(addButton("Add genome group")).queryByRole("status", {
        name: "Loading",
      }),
    ).toBeNull();

    act(() => {
      gate.resolve();
    });
    await waitFor(() => {
      expect(responded).toBe(true);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByText(groupPath)).not.toBeInTheDocument();
  });

  it.each([
    {
      preset: "alignedDnaFastaOrContigs",
      button: "Add aligned sequence",
      typeLabel: "Aligned DNA FASTA",
    },
    {
      preset: "featureDnaFasta",
      button: "Add unaligned sequence",
      typeLabel: "Unaligned DNA FASTA",
    },
  ])("lists the file picked for $button", async ({ preset, button, typeLabel }) => {
    const user = userEvent.setup();
    render(<ViralGenomeTreePage />);

    await user.click(screen.getByRole("button", { name: `Pick ${preset}` }));
    await user.click(addButton(button));

    expect(
      within(await findSelectedRow(pickedPaths[preset])).getByRole("cell", {
        name: typeLabel,
      }),
    ).toBeInTheDocument();
    expect(addButton(button)).toBeDisabled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
