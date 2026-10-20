import { act, render, screen, within } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-helpers/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, type ReactNode } from "react";
import GenomeAlignmentServicePage from "../page";
import type { GenomeSummary } from "@/lib/services/genome";

const mocks = vi.hoisted(() => ({
  fetchGenomeGroupMembers: vi.fn(),
  fetchGenomesByIds: vi.fn(),
  runtimeConfig: undefined as
    | { rerun?: { onApply?: (data: Record<string, unknown>, form: object) => void } }
    | undefined,
}));

vi.mock("@/lib/services/genome", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/services/genome")>();
  return {
    ...original,
    fetchGenomeGroupMembers: mocks.fetchGenomeGroupMembers,
    fetchGenomesByIds: mocks.fetchGenomesByIds,
  };
});

vi.mock("@/hooks/services/use-service-runtime", () => ({
  useServiceRuntime: (config: typeof mocks.runtimeConfig) => {
    mocks.runtimeConfig = config;
    return { isSubmitting: false, jobParamsDialogProps: {} };
  },
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

vi.mock("@/components/services/genome-name-selector", () => ({
  GenomeNameSelector: ({ onSelect }: { onSelect: (genome: GenomeSummary) => void }) => (
    <button
      type="button"
      onClick={() => {
        onSelect({ genome_id: "manual", genome_name: "Manual genome" });
      }}
    >
      Add individual genome
    </button>
  ),
}));

vi.mock("@/components/workspace/workspace-object-selector", () => ({
  WorkspaceObjectSelector: ({
    value,
    onObjectSelect,
    onSelectedObjectChange,
  }: {
    value?: string;
    onObjectSelect: (object: { id: string; name: string; path: string }) => void;
    onSelectedObjectChange?: (
      object: { id: string; name: string; path: string } | null,
    ) => void;
  }) => (
    <>
      {/* Uncontrolled like the real selector's search text: only a remount clears it. */}
      <input aria-label="Search genome groups" />
      <output aria-label="Genome group value">
        {value === undefined ? "<no value prop>" : value}
      </output>
      <button
        type="button"
        onClick={() => {
          onObjectSelect({ id: "group", name: "Test group", path: "/groups/test" });
        }}
      >
        Select genome group
      </button>
      <button
        type="button"
        onClick={() => {
          onSelectedObjectChange?.({
            id: "group",
            name: "Test group",
            path: "/groups/test",
          });
        }}
      >
        Stage genome group
      </button>
    </>
  ),
}));

vi.mock("@/components/forms/required-form-components", () => ({
  RequiredFormCardTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => { resolve = promiseResolve; });
  return { promise, resolve };
}

const groupGenome: GenomeSummary = {
  genome_id: "group-genome",
  genome_name: "Group genome",
};

const rerunGenome: GenomeSummary = {
  genome_id: "rerun-genome",
  genome_name: "Rerun genome",
};

describe("GenomeAlignmentServicePage selection races", () => {
  beforeEach(() => {
    mocks.fetchGenomeGroupMembers.mockReset();
    mocks.fetchGenomesByIds.mockReset();
    mocks.runtimeConfig = undefined;
  });

  it("does not apply a group response after reset", async () => {
    const request = deferred<GenomeSummary[]>();
    mocks.fetchGenomeGroupMembers.mockReturnValue(request.promise);
    const user = userEvent.setup();

    render(<GenomeAlignmentServicePage />, { wrapper: createQueryClientWrapper() });
    await user.click(screen.getByRole("button", { name: "Select genome group" }));
    await user.click(screen.getByRole("button", { name: "Reset" }));

    act(() => { request.resolve([groupGenome]); });
    await request.promise;

    expect(screen.queryByText("Group genome")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Loading genomes from workspace group..."),
    ).not.toBeInTheDocument();
  });

  it("clears the genome group search text and last added group on reset", async () => {
    mocks.fetchGenomeGroupMembers.mockResolvedValue([groupGenome]);
    const user = userEvent.setup();

    render(<GenomeAlignmentServicePage />, { wrapper: createQueryClientWrapper() });
    await user.type(
      screen.getByRole("textbox", { name: "Search genome groups" }),
      "influenza",
    );
    await user.click(screen.getByRole("button", { name: "Select genome group" }));
    expect(
      await screen.findByText("Last group added: Test group"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(
      screen.getByRole("textbox", { name: "Search genome groups" }),
    ).toHaveValue("");
    expect(
      screen.queryByText("Last group added: Test group"),
    ).not.toBeInTheDocument();
  });

  it("does not apply rerun genomes after an individual selection edit", async () => {
    const request = deferred<GenomeSummary[]>();
    mocks.fetchGenomesByIds.mockReturnValue(request.promise);
    const user = userEvent.setup();

    render(<GenomeAlignmentServicePage />, { wrapper: createQueryClientWrapper() });
    act(() => {
      mocks.runtimeConfig?.rerun?.onApply?.(
        { genome_ids: ["rerun-genome"] },
        { setFieldValue: vi.fn() },
      );
    });
    await user.click(screen.getByRole("button", { name: "Add individual genome" }));

    act(() => { request.resolve([rerunGenome]); });
    await request.promise;

    expect(screen.getByText("Manual genome")).toBeInTheDocument();
    expect(screen.queryByText("Rerun genome")).not.toBeInTheDocument();
  });

  it("shows the staged group, and clears it once added", async () => {
    mocks.fetchGenomeGroupMembers.mockResolvedValue([groupGenome]);
    const user = userEvent.setup();
    render(<GenomeAlignmentServicePage />, { wrapper: createQueryClientWrapper() });

    await user.click(screen.getByRole("button", { name: "Stage genome group" }));
    expect(screen.getByLabelText("Genome group value")).toHaveTextContent(
      "/groups/test",
    );

    await user.click(screen.getByRole("button", { name: "Add genome group" }));
    expect(screen.getByLabelText("Genome group value")).toHaveTextContent(/^$/);
  });
});

// Rule 11: "Select at least two genomes" is a response to something the user
// did, not to the empty form. These run the real page, field and schema.
describe("GenomeAlignmentServicePage genome-count error", () => {
  const countError = "Select at least two genomes";
  const secondGroupGenome: GenomeSummary = {
    genome_id: "group-genome-2",
    genome_name: "Second group genome",
  };

  beforeEach(() => {
    mocks.fetchGenomeGroupMembers.mockReset();
    mocks.fetchGenomesByIds.mockReset();
    mocks.runtimeConfig = undefined;
  });

  it("is not shown on first paint, nor when Strict Mode runs the sync twice", () => {
    render(
      <StrictMode>
        <GenomeAlignmentServicePage />
      </StrictMode>,
      { wrapper: createQueryClientWrapper() },
    );

    expect(screen.queryByText(countError)).not.toBeInTheDocument();
  });

  it("is shown after one genome is added and is not shown right after Reset", async () => {
    const user = userEvent.setup();

    render(<GenomeAlignmentServicePage />, { wrapper: createQueryClientWrapper() });
    await user.click(screen.getByRole("button", { name: "Add individual genome" }));
    expect(await screen.findByText(countError)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.queryByText("Manual genome")).not.toBeInTheDocument();
    expect(screen.queryByText(countError)).not.toBeInTheDocument();
  });

  it("is not shown right after Reset from a valid selection of two", async () => {
    mocks.fetchGenomeGroupMembers.mockResolvedValue([groupGenome, secondGroupGenome]);
    const user = userEvent.setup();

    render(<GenomeAlignmentServicePage />, { wrapper: createQueryClientWrapper() });
    await user.click(screen.getByRole("button", { name: "Select genome group" }));
    expect(await screen.findByText("Second group genome")).toBeInTheDocument();
    expect(screen.queryByText(countError)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.queryByText("Second group genome")).not.toBeInTheDocument();
    expect(screen.queryByText(countError)).not.toBeInTheDocument();
  });

  it("comes back when removing a genome drops the selection below two", async () => {
    mocks.fetchGenomeGroupMembers.mockResolvedValue([groupGenome, secondGroupGenome]);
    const user = userEvent.setup();

    render(<GenomeAlignmentServicePage />, { wrapper: createQueryClientWrapper() });
    await user.click(screen.getByRole("button", { name: "Select genome group" }));
    expect(await screen.findByText("Second group genome")).toBeInTheDocument();
    expect(screen.queryByText(countError)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove Second group genome" }));
    expect(await screen.findByText(countError)).toBeInTheDocument();

    // Removing the last one builds a new empty array: still a user action.
    await user.click(screen.getByRole("button", { name: "Remove Group genome" }));
    expect(await screen.findByText(countError)).toBeInTheDocument();
  });
});

describe("GenomeAlignmentServicePage selected genome rows", () => {
  beforeEach(() => {
    mocks.fetchGenomeGroupMembers.mockReset();
    mocks.fetchGenomesByIds.mockReset();
  });

  it("lists each genome with its ID in BLAST's table, tagging the first as the reference", async () => {
    mocks.fetchGenomeGroupMembers.mockResolvedValue([
      groupGenome,
      { genome_id: "group-genome-2", genome_name: "Second group genome" },
    ]);
    const user = userEvent.setup();

    render(<GenomeAlignmentServicePage />, { wrapper: createQueryClientWrapper() });
    expect(
      within(screen.getByRole("table", { name: "Selected genomes" })).getByRole(
        "cell",
        { name: "No genomes selected" },
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Select genome group" }));
    await screen.findByText("Second group genome");

    const rows = within(
      screen.getByRole("table", { name: "Selected genomes" }),
    ).getAllByRole("row");
    // The header row, then one row per genome in selection order.
    expect(rows.map((row) => row.textContent)).toEqual([
      "GenomeGenome IDRemove",
      "Group genomeReferencegroup-genome",
      "Second group genomegroup-genome-2",
    ]);
  });
});

describe("GenomeAlignmentServicePage advanced options layout", () => {
  it("opens the seed weight slider under its toggle, leaving Weight in its own column", async () => {
    const user = userEvent.setup();
    render(<GenomeAlignmentServicePage />, { wrapper: createQueryClientWrapper() });
    await user.click(screen.getByRole("button", { name: /Advanced Options/ }));

    const toggle = screen.getByRole("switch", { name: "Manually Set Seed Weight" });
    const weightLabel = screen.getByText("Weight", { selector: "label" });
    const grid = toggle.closest(".service-card-content-grid");
    const toggleColumn = [...(grid?.children ?? [])].find((column) =>
      column.contains(toggle),
    );
    const weightColumnBefore = [...(grid?.children ?? [])].find((column) =>
      column.contains(weightLabel),
    );

    await user.click(toggle);

    const slider = screen.getByText("Seed Weight", { selector: "label" });
    // The slider joins the toggle's column; Weight keeps the same grid cell
    // (it used to be pushed onto a new row by the slider).
    expect(toggleColumn).toContainElement(slider);
    expect(toggleColumn).not.toContainElement(weightLabel);
    expect(grid?.children).toHaveLength(2);
    expect(
      [...(grid?.children ?? [])].find((column) => column.contains(weightLabel)),
    ).toBe(weightColumnBefore);
  });
});

describe("GenomeAlignmentServicePage rerun when the genome lookup fails", () => {
  beforeEach(() => {
    mocks.fetchGenomeGroupMembers.mockReset();
    mocks.fetchGenomesByIds.mockReset();
    mocks.runtimeConfig = undefined;
  });

  function selectedRows() {
    return within(screen.getByRole("table", { name: "Selected genomes" }))
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.textContent);
  }

  it("keeps the job's genome IDs, says why they are unnamed, and retries the lookup", async () => {
    mocks.fetchGenomesByIds
      .mockRejectedValueOnce(
        new Error("BV-BRC genome lookup failed: 500 Internal Server Error"),
      )
      .mockResolvedValueOnce([
        rerunGenome,
        { genome_id: "rerun-genome-2", genome_name: "Second rerun genome" },
      ]);
    const user = userEvent.setup();

    render(<GenomeAlignmentServicePage />, { wrapper: createQueryClientWrapper() });
    act(() => {
      mocks.runtimeConfig?.rerun?.onApply?.(
        { genome_ids: ["rerun-genome", "rerun-genome-2"] },
        { setFieldValue: vi.fn() },
      );
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Genome names could not be loaded");
    expect(alert).toHaveTextContent(
      "BV-BRC genome lookup failed: 500 Internal Server Error",
    );
    expect(alert).toHaveTextContent("rerun-genome, rerun-genome-2");
    expect(selectedRows()).toEqual([
      "rerun-genomeReferencererun-genome",
      "rerun-genome-2rerun-genome-2",
    ]);
    expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();

    await user.click(within(alert).getByRole("button", { name: "Retry" }));

    await screen.findByText("Second rerun genome");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mocks.fetchGenomesByIds).toHaveBeenLastCalledWith([
      "rerun-genome",
      "rerun-genome-2",
    ]);
  });

  it("lists IDs the lookup did not return instead of dropping them", async () => {
    mocks.fetchGenomesByIds.mockResolvedValue([rerunGenome]);

    render(<GenomeAlignmentServicePage />, { wrapper: createQueryClientWrapper() });
    act(() => {
      mocks.runtimeConfig?.rerun?.onApply?.(
        { genome_ids: ["rerun-genome", "gone-genome"] },
        { setFieldValue: vi.fn() },
      );
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Some genomes from the previous job were not found",
    );
    expect(alert).toHaveTextContent("Listed by ID only: gone-genome.");
    expect(selectedRows()).toEqual([
      "Rerun genomeReferencererun-genome",
      "gone-genomegone-genome",
    ]);
  });
});
