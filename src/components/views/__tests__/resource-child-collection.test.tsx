import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FeatureViewRecord } from "@/lib/feature-view";
import type { GenomeViewRecord } from "@/lib/genome-view";
import type { useResourceCollection as useResourceCollectionHook } from "@/hooks/views/use-resource-collection";
import { FeatureMember } from "@/app/(views)/feature/[featureId]/feature-member";
import { GenomeMember } from "@/app/(views)/genome/[genomeId]/genome-member";
import { ResourceChildCollection } from "../resource-child-collection";
import type { ResourceCollectionProfile } from "../resource-collection";

const {
  exportAll,
  resourceCollectionProfile,
  useRealResourceCollection,
  useResourceCollection,
} = vi.hoisted(() => ({
  exportAll: vi.fn().mockResolvedValue({ rows: [] }),
  resourceCollectionProfile: vi.fn(),
  useRealResourceCollection: { current: false },
  useResourceCollection: vi.fn<typeof useResourceCollectionHook>(),
}));

vi.mock("@/lib/data-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data-api")>()),
  DataRepository: class {
    exportAll = exportAll;
  },
}));

vi.mock("@/components/views/entity-view-shell", () => ({
  EntityViewShell: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/hooks/views/use-resource-collection", () => ({
  useResourceCollection,
}));
vi.mock("@/components/search/search-action-bar", () => ({
  SearchActionBar: ({
    onAction,
  }: {
    onAction?: (action: string) => void;
  }) => <button onClick={() => onAction?.("biosets")}>Bioset Results</button>,
}));
vi.mock("../resource-workspace", () => ({
  ResourceWorkspace: ({
    children,
    actionBar,
  }: {
    children: ReactNode;
    actionBar: ReactNode;
  }) => (
    <div>
      {actionBar}
      {children}
    </div>
  ),
}));
vi.mock("@/components/shared/data-table", () => ({
  DataTable: () => null,
}));

vi.mock("../resource-collection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../resource-collection")>();
  return {
    ...actual,
    ResourceCollection: (
      props: React.ComponentProps<typeof actual.ResourceCollection>,
    ) => {
      resourceCollectionProfile(props.profile);
      if (useRealResourceCollection.current) {
        return <actual.ResourceCollection {...props} />;
      }
      return (
        <div>
          <output data-testid="collection-state">
            {JSON.stringify(props.state)}
          </output>
          <button
            onClick={() => {
              props.onStateChange({
                filters: { status: ["active"] },
                page: 4,
                sort: "custom:desc",
              });
            }}
          >
            Change collection state
          </button>
          <button
            onClick={() =>
              void props.onExport?.({ format: "csv", fields: null, rql: "" })
            }
          >
            Export all
          </button>
        </div>
      );
    },
  };
});

const changedState = {
  filters: { status: ["active"] },
  page: 4,
  sort: "custom:desc",
};

beforeEach(() => {
  useRealResourceCollection.current = false;
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:test"),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => vi.unstubAllGlobals());

async function changeCollectionState() {
  await userEvent.click(
    screen.getByRole("button", { name: "Change collection state" }),
  );
  expect(screen.getByTestId("collection-state")).toHaveTextContent(
    JSON.stringify(changedState),
  );
}

describe("ResourceChildCollection scope changes", () => {
  it("keeps a filtered Bioset collection scoped to its experiment", () => {
    render(
      <ResourceChildCollection
        resource="bioset"
        label="Biosets"
        idField="bioset_id"
        rql="eq(exp_id,experiment-1)"
        defaultSort="bioset_id:asc"
      />,
    );

    const profile = resourceCollectionProfile.mock.lastCall?.[0] as
      | ResourceCollectionProfile<Record<string, unknown>>
      | undefined;
    expect(profile?.basePredicate).toBe("eq(exp_id,experiment-1)");
    expect(
      profile?.buildStructuralRql?.({
        filters: { bioset_type: ["Differential Expression"] },
        page: 1,
        sort: "bioset_id:asc",
      }),
    ).toBe(
      'and(eq(exp_id,experiment-1),eq(bioset_type,"Differential%20Expression"))',
    );
  });

  it("keeps a supplied profile scoped to its parent predicate", () => {
    const suppliedProfile: ResourceCollectionProfile<
      Record<string, unknown>
    > = {
      resource: "genome",
      label: "Genomes",
      idField: "genome_id",
      columns: [],
      defaultSort: "genome_id:asc",
      buildStructuralRql: () => 'eq(status,"active")',
    };

    render(
      <ResourceChildCollection
        resource="genome"
        label="Related genomes"
        idField="genome_id"
        rql="eq(parent_id,parent-1)"
        defaultSort="genome_id:asc"
        profile={suppliedProfile}
      />,
    );

    const profile = resourceCollectionProfile.mock.lastCall?.[0] as
      | ResourceCollectionProfile<Record<string, unknown>>
      | undefined;
    expect(profile?.basePredicate).toBe("eq(parent_id,parent-1)");
    expect(profile?.buildStructuralRql?.(changedState)).toBe(
      'and(eq(parent_id,parent-1),eq(status,"active"))',
    );
  });

  it("does not open partial Bioset results for an all-pages selection", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const replace = vi.fn();
    vi.stubGlobal(
      "open",
      vi.fn(() => ({ close, opener: window, location: { replace } })),
    );
    exportAll.mockResolvedValueOnce({
      rows: [{ exp_id: "00042" }, { bioset_id: "bioset-2" }],
    });
    useResourceCollection.mockReturnValue({
      activeId: null,
      detail: null,
      detailError: null,
      facets: {},
      isAllPagesSelected: true,
      isDetailLoading: false,
      isInitialLoading: false,
      isRefreshing: false,
      error: null,
      refetch: vi.fn(),
      rows: [{ bioset_id: "bioset-1", exp_id: "00042" }],
      selection: {},
      selectedIds: [],
      sorting: [{ id: "bioset_id", desc: false }],
      total: 2,
      setIsAllPagesSelected: vi.fn(),
      setSelection: vi.fn(),
      setPageIndex: vi.fn(),
      setSorting: vi.fn(),
    });
    useRealResourceCollection.current = true;

    render(
      <ResourceChildCollection
        resource="bioset"
        label="Biosets"
        idField="bioset_id"
        rql="eq(exp_id,experiment-1)"
        defaultSort="bioset_id:asc"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Bioset Results" }));

    await waitFor(() => {
      expect(close).toHaveBeenCalledOnce();
    });
    expect(exportAll).toHaveBeenCalledWith(
      "bioset",
      expect.objectContaining({
        rql: "eq(exp_id,experiment-1)",
        fields: ["exp_id"],
      }),
    );
    expect(replace).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Some selected Biosets are not associated with experiments.",
      ),
    ).toBeInTheDocument();
  });

  it("resets state when FeatureMember switches child tabs", async () => {
    const feature = {
      feature_id: "feature-1",
      patric_id: "fig|feature-1",
    } as FeatureViewRecord;
    const { rerender } = render(
      <FeatureMember feature={feature} activeTab="interactions" />,
    );
    await changeCollectionState();

    rerender(<FeatureMember feature={feature} activeTab="domains" />);

    expect(screen.getByTestId("collection-state")).toHaveTextContent(
      JSON.stringify({ filters: {}, page: 1, sort: "unsorted" }),
    );
  });

  it("resets state when GenomeMember switches child tabs", async () => {
    const genome = {
      genome_id: "genome-1",
      genome_name: "Genome 1",
    } as GenomeViewRecord;
    const { rerender } = render(
      <GenomeMember genome={genome} activeTab="features" />,
    );
    await changeCollectionState();

    rerender(<GenomeMember genome={genome} activeTab="proteins" />);

    expect(screen.getByTestId("collection-state")).toHaveTextContent(
      JSON.stringify({ filters: {}, page: 1, sort: "patric_id:asc" }),
    );
  });

  it("omits sorting when exporting an unsorted child collection", async () => {
    const genome = {
      genome_id: "genome-1",
      genome_name: "Genome 1",
    } as GenomeViewRecord;
    render(<GenomeMember genome={genome} activeTab="domains" />);

    await userEvent.click(screen.getByRole("button", { name: "Export all" }));

    expect(exportAll).toHaveBeenCalledWith(
      "protein_feature",
      expect.objectContaining({ sort: undefined }),
    );
  });
});
