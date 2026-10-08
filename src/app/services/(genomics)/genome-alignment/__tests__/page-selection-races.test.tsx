import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
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
    onObjectSelect,
  }: {
    onObjectSelect: (object: { id: string; name: string; path: string }) => void;
  }) => (
    <>
      {/* Uncontrolled like the real selector's search text: only a remount clears it. */}
      <input aria-label="Search genome groups" />
      <button
        type="button"
        onClick={() => {
          onObjectSelect({ id: "group", name: "Test group", path: "/groups/test" });
        }}
      >
        Select genome group
      </button>
    </>
  ),
}));

vi.mock("@/components/services/selected-items-table", () => ({
  default: ({ items }: { items: { id: string; name: string }[] }) => (
    <div>{items.map((item) => <span key={item.id}>{item.name}</span>)}</div>
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

    render(<GenomeAlignmentServicePage />);
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

    render(<GenomeAlignmentServicePage />);
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

    render(<GenomeAlignmentServicePage />);
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
});
