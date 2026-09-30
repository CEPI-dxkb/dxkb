import type { ReactNode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DataRepository } from "@/lib/data-api";
import type { FeatureViewRecord } from "@/lib/feature-view";
import type { GenomeViewRecord } from "@/lib/genome-view";
import type { useResourceCollection as useResourceCollectionHook } from "@/hooks/views/use-resource-collection";
import { resetChildCollectionPage } from "@/hooks/views/use-child-collection-url-state";
import { FeatureMember } from "@/app/(views)/feature/[featureId]/feature-member";
import { GenomeMember } from "@/app/(views)/genome/[genomeId]/genome-member";
import { ResourceChildCollection } from "../resource-child-collection";
import {
  ResourceCollection,
  type ResourceCollectionProfile,
} from "../resource-collection";
import { createResourceCollectionResult } from "./fixtures/resource-collection-result";

const {
  exportAll,
  selected,
  resourceCollectionProfile,
  resourceCollectionProps,
  useRealResourceCollection,
  useResourceCollection,
} = vi.hoisted(() => ({
  exportAll: vi.fn().mockResolvedValue({ rows: [] }),
  selected: vi.fn().mockResolvedValue({ rows: [] }),
  resourceCollectionProfile: vi.fn(),
  resourceCollectionProps: vi.fn(),
  useRealResourceCollection: { current: false },
  useResourceCollection: vi.fn<typeof useResourceCollectionHook>(),
}));

vi.mock("next/navigation", async () =>
  (await import("@/test-helpers/history-navigation")).historyNavigationMock({
    pathname: "/genome/1.1",
  }),
);
vi.mock("@tanstack/react-query", async () =>
  (await import("./fixtures/resource-collection-mocks")).reactQueryMock(),
);
vi.mock("@/lib/auth/provider", async () =>
  (await import("./fixtures/resource-collection-mocks")).authProviderMock(),
);
vi.mock("@/contexts/workspace-repository-context", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).workspaceRepositoryContextMock(),
);
vi.mock("@/components/views/collection-copy-dialog", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).collectionCopyDialogMock(),
);
vi.mock("@/components/views/selection-service-chooser", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).selectionServiceChooserMock(),
);
vi.mock("@/components/workspace/selection-to-group-dialog", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).selectionToGroupDialogMock(),
);

vi.mock("@/lib/data-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data-api")>()),
  DataRepository: class {
    exportAll = exportAll;
    selected = selected;
  },
}));

vi.mock("@/components/views/entity-view-shell", () => ({
  EntityViewShell: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/hooks/views/use-resource-collection", () => ({
  useResourceCollection,
}));
vi.mock("@/components/search/search-action-bar", () => ({
  SearchActionBar: ({ onAction }: { onAction?: (action: string) => void }) => (
    <button onClick={() => onAction?.("biosets")}>Bioset Results</button>
  ),
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
  DataTable: (props: Record<string, unknown>) => {
    return (
      <div data-testid="data-table">
        <button
          onClick={() =>
            void (
              props.onDownloadAll as (
                format: "csv",
                fields: string[] | null,
              ) => Promise<void>
            )("csv", null)
          }
        >
          Real export all
        </button>
        <button
          onClick={() =>
            void (
              props.onDownloadAll as (
                format: "txt",
                fields: string[] | null,
              ) => Promise<void>
            )("txt", null)
          }
        >
          Real export all TSV
        </button>
        <button
          onClick={() =>
            void (
              props.onDownloadSelected as (
                format: "csv",
                ids: string[],
                fields: string[] | null,
              ) => Promise<void>
            )("csv", ["1ABC"], ["pdb_id"])
          }
        >
          Real export selected
        </button>
      </div>
    );
  },
}));

vi.mock("../resource-collection", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../resource-collection")>();
  return {
    ...actual,
    ResourceCollection: (
      props: React.ComponentProps<typeof actual.ResourceCollection>,
    ) => {
      resourceCollectionProfile(props.profile);
      resourceCollectionProps(props);
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
                filters: {},
                page: 1,
                sort: "id:asc",
                keyword: "dnaK",
              });
            }}
          >
            Search the server
          </button>
        </div>
      );
    },
  };
});

// Every child sort allowlist takes "unsorted", and the URL only carries a state its
// profile could have produced, so a sort or filter the profile lacks would throw.
const changedState = {
  filters: {},
  page: 4,
  sort: "unsorted",
};

beforeEach(() => {
  window.history.replaceState(null, "", "/genome/1.1");
  useRealResourceCollection.current = false;
  exportAll.mockClear();
  selected.mockClear();
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:test"),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => vi.unstubAllGlobals());

/** Minimal, valid `useResourceCollection` return value for a real-render export test. */
const realCollectionResult = createResourceCollectionResult;

/**
 * Captures the Blob and filename `downloadResourceExport` hands to the DOM, the
 * same way `list-data-download-selected.test.tsx` does — this file does not mock
 * `../resource-export`, so a real render exercises the real serializer.
 */
function spyOnDownload() {
  let exportedBlob: Blob | undefined;
  let downloadedFilename: string | undefined;
  vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
    exportedBlob = blob as Blob;
    return "blob:test";
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloadedFilename = this.download;
  });
  return {
    text: async () => {
      await waitFor(() => {
        expect(exportedBlob).toBeDefined();
      });
      return exportedBlob?.text();
    },
    filename: async () => {
      await waitFor(() => {
        expect(downloadedFilename).toBeDefined();
      });
      return downloadedFilename;
    },
  };
}

/** The state the mocked collection is currently showing, as it received it. */
function shownCollectionState() {
  return JSON.parse(screen.getByTestId("collection-state").textContent) as unknown;
}

/** Has the table report `state`, as its own pager, sort header or facets would. */
function changeCollectionState(state: typeof changedState = changedState) {
  act(() => {
    lastResourceCollectionProps().onStateChange(state);
  });
  expect(shownCollectionState()).toStrictEqual(state);
}

const interactionsChildProps = {
  urlKey: "interactions",
  resource: "ppi",
  label: "Interactions",
  idField: "id",
  rql: "eq(evidence,experimental)",
  columns: [{ id: "id", label: "ID" }],
  defaultSort: "id:asc",
} as const;

describe("ResourceChildCollection controlled server keyword", () => {
  it("puts the owner's keyword on the request state", () => {
    render(
      <ResourceChildCollection
        {...interactionsChildProps}
        keywordValue="groEL"
        onKeywordChange={vi.fn()}
      />,
    );

    // A caller sharing one keyword box with a sibling view (the Interactions
    // Graph) needs that text to be a request predicate, not a filter over the
    // page already loaded — otherwise the two views answer the same input with
    // different datasets.
    expect(screen.getByTestId("collection-state")).toHaveTextContent(
      '"keyword":"groEL"',
    );
  });

  it("reports keyword edits to the owner and keeps none of its own", async () => {
    const onKeywordChange = vi.fn();
    render(
      <ResourceChildCollection
        {...interactionsChildProps}
        keywordValue=""
        onKeywordChange={onKeywordChange}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Search the server" }),
    );

    expect(onKeywordChange).toHaveBeenCalledWith("dnaK");
    // Nothing kept locally: the owner's value is the single source, so the
    // sibling view can never be one edit behind.
    expect(screen.getByTestId("collection-state")).not.toHaveTextContent(
      '"keyword"',
    );
  });

  it("restarts at page 1 when the owner's keyword changes", () => {
    const { rerender } = render(
      <ResourceChildCollection
        {...interactionsChildProps}
        keywordValue=""
        onKeywordChange={vi.fn()}
      />,
    );

    changeCollectionState();

    rerender(
      <ResourceChildCollection
        {...interactionsChildProps}
        keywordValue="groEL"
        onKeywordChange={vi.fn()}
      />,
    );

    // A keyword arriving as a prop never passes through `onStateChange`, so
    // nothing else in the stack (no clamp in `useResourceCollection`, none in
    // `ResourceCollection`) could notice the page it was paged into is now past
    // the end of a smaller result set.
    const collectionState = screen.getByTestId("collection-state");
    expect(collectionState).toHaveTextContent('"page":1');
    expect(collectionState).toHaveTextContent('"keyword":"groEL"');
  });

  it("leaves paging alone when the shared keyword filters client-side", () => {
    // "loaded" mode is a filter over the rows already fetched, not a request
    // predicate, so the page it is filtering stays meaningful. Only the
    // controlled *server* keyword path resets it.
    const { rerender } = render(
      <ResourceChildCollection
        {...interactionsChildProps}
        keywordMode="loaded"
        keywordValue="a"
        onKeywordChange={vi.fn()}
      />,
    );

    changeCollectionState();

    rerender(
      <ResourceChildCollection
        {...interactionsChildProps}
        keywordMode="loaded"
        keywordValue="b"
        onKeywordChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("collection-state")).toHaveTextContent(
      '"page":4',
    );
  });
});

const assaysChildProps = {
  urlKey: "assays",
  resource: "epitope_assay",
  label: "Assays",
  idField: "assay_id",
  rql: "eq(epitope_id,1)",
  columns: [
    { id: "assay_id", label: "Assay ID" },
    { id: "assay_type", label: "Assay Type" },
  ],
  defaultSort: "assay_id:asc",
} as const;

function renderChild(overrides: Partial<typeof assaysChildProps> = {}) {
  return render(<ResourceChildCollection {...assaysChildProps} {...overrides} />);
}

function lastResourceCollectionProps() {
  const props = resourceCollectionProps.mock.lastCall?.[0] as
    | React.ComponentProps<typeof ResourceCollection>
    | undefined;
  if (!props) throw new Error("ResourceCollection has not rendered");
  return props;
}

describe("ResourceChildCollection URL state", () => {
  it("restores its page and sort from its own prefixed params", () => {
    window.history.replaceState(
      null,
      "",
      "/genome/1.1?tab=assays&assays.page=2&assays.sort=assay_id:desc",
    );
    renderChild();
    expect(lastResourceCollectionProps().state).toMatchObject({
      page: 2,
      sort: "assay_id:desc",
    });
  });

  it("ignores the page's own params and a sibling table's", () => {
    window.history.replaceState(
      null,
      "",
      "/genome/1.1?tab=assays&page=7&sort=assay_id:desc&keyword=x&domains.page=5",
    );
    renderChild();
    expect(lastResourceCollectionProps().state).toStrictEqual({
      keyword: undefined,
      refine: undefined,
      rql: undefined,
      filters: {},
      page: 1,
      sort: "assay_id:asc",
    });
  });

  it("writes state changes under its prefix without touching the page's params", () => {
    window.history.replaceState(null, "", "/genome/1.1?tab=assays");
    const pushState = vi.spyOn(window.history, "pushState");
    renderChild();
    act(() => {
      lastResourceCollectionProps().onStateChange({
        filters: {},
        page: 3,
        sort: "assay_id:asc",
      });
    });
    expect(pushState).toHaveBeenCalledWith(
      null,
      "",
      "/genome/1.1?tab=assays&assays.page=3",
    );
    expect(lastResourceCollectionProps().state).toMatchObject({ page: 3 });
  });

  it("does not adopt another table's params after a tab switch", () => {
    window.history.replaceState(null, "", "/genome/1.1?assays.page=2");
    const { rerender } = renderChild();
    rerender(
      <ResourceChildCollection
        {...assaysChildProps}
        urlKey="biosets"
        resource="bioset"
        defaultSort="bioset_id:asc"
      />,
    );
    expect(lastResourceCollectionProps().state).toMatchObject({ page: 1 });
  });

  describe("with a keyword box shared with a sibling view", () => {
    const sharedKeywordProps = { ...assaysChildProps, keywordValue: "" };

    it("shows page 1 for a new keyword until the URL drops the stale page", () => {
      window.history.replaceState(null, "", "/genome/1.1?assays.page=4");
      const { rerender } = render(
        <ResourceChildCollection {...sharedKeywordProps} />,
      );
      expect(lastResourceCollectionProps().state).toMatchObject({ page: 4 });

      rerender(
        <ResourceChildCollection {...sharedKeywordProps} keywordValue="ha" />,
      );
      expect(lastResourceCollectionProps().state).toMatchObject({
        keyword: "ha",
        page: 1,
      });
      // The owner has not dropped the param yet, so the URL still says page 4.
      expect(window.location.search).toBe("?assays.page=4");

      act(() => {
        resetChildCollectionPage("assays");
      });
      expect(window.location.search).toBe("");
      expect(lastResourceCollectionProps().state).toMatchObject({ page: 1 });
    });

    it("lets the user page onward once the bridge has done its job", () => {
      window.history.replaceState(null, "", "/genome/1.1?assays.page=4");
      const { rerender } = render(
        <ResourceChildCollection {...sharedKeywordProps} />,
      );
      rerender(
        <ResourceChildCollection {...sharedKeywordProps} keywordValue="ha" />,
      );
      act(() => {
        lastResourceCollectionProps().onStateChange({
          filters: {},
          page: 2,
          sort: "assay_id:asc",
          keyword: "ha",
        });
      });
      // Paging on is not held on page 1 by the pending reset.
      expect(lastResourceCollectionProps().state).toMatchObject({ page: 2 });
      expect(window.location.search).toBe("?assays.page=2");
    });

    it("keeps the shared keyword out of the URL", () => {
      window.history.replaceState(null, "", "/genome/1.1");
      render(
        <ResourceChildCollection {...sharedKeywordProps} keywordValue="ha" />,
      );
      act(() => {
        lastResourceCollectionProps().onStateChange({
          filters: {},
          page: 2,
          sort: "assay_id:asc",
          keyword: "ha",
        });
      });
      expect(window.location.search).toBe("?assays.page=2");
    });
  });
});

describe("ResourceChildCollection scope changes", () => {
  it("keeps a filtered Bioset collection scoped to its experiment", () => {
    render(
      <ResourceChildCollection
        resource="bioset"
        urlKey="biosets"
        label="Biosets"
        idField="bioset_id"
        rql="eq(exp_id,experiment-1)"
        defaultSort="bioset_id:asc"
      />,
    );

    const profile = resourceCollectionProfile.mock.lastCall?.[0] as
      ResourceCollectionProfile<Record<string, unknown>> | undefined;
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
    const suppliedProfile: ResourceCollectionProfile<Record<string, unknown>> =
      {
        resource: "genome",
        label: "Genomes",
        idField: "genome_id",
        columns: [],
        buildStructuralRql: () => 'eq(status,"active")',
      };

    render(
      <ResourceChildCollection
        resource="genome"
        urlKey="structures"
        label="Related genomes"
        idField="genome_id"
        rql="eq(parent_id,parent-1)"
        defaultSort="genome_id:asc"
        profile={suppliedProfile}
      />,
    );

    const profile = resourceCollectionProfile.mock.lastCall?.[0] as
      ResourceCollectionProfile<Record<string, unknown>> | undefined;
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
        urlKey="biosets"
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

  // Each test leaves the source tab with a sort its table accepts that is not the
  // destination tab's default, so state carrying over would show in the
  // destination. The Genome pair also shares a profile, so its facet filter would
  // survive parsing there too; Feature's tabs have no facets in common, so that
  // test can only pin the sort.
  it("resets state when FeatureMember switches child tabs", () => {
    const feature = {
      feature_id: "feature-1",
      patric_id: "fig|feature-1",
    } as FeatureViewRecord;
    const { rerender } = render(
      <FeatureMember feature={feature} activeTab="domains" />,
    );
    changeCollectionState({
      filters: { feature_type: ["domain"] },
      page: 4,
      sort: "id:desc",
    });

    rerender(<FeatureMember feature={feature} activeTab="interactions" />);

    expect(shownCollectionState()).toStrictEqual({
      filters: {},
      page: 1,
      sort: "id:asc",
    });
  });

  it("resets state when GenomeMember switches child tabs", () => {
    const genome = {
      genome_id: "genome-1",
      genome_name: "Genome 1",
    } as GenomeViewRecord;
    const { rerender } = render(
      <GenomeMember genome={genome} activeTab="features" />,
    );
    changeCollectionState({
      filters: { feature_type: ["CDS"] },
      page: 4,
      sort: "start:desc",
    });

    rerender(<GenomeMember genome={genome} activeTab="proteins" />);

    expect(shownCollectionState()).toStrictEqual({
      filters: {},
      page: 1,
      sort: "patric_id:asc",
    });
  });

  it("supplies the canonical protein-structure profile to its child tab", () => {
    render(
      <ResourceChildCollection
        resource="protein_structure"
        urlKey="structures"
        label="Protein Structures"
        idField="pdb_id"
        rql="eq(genome_id,83332.12)"
        defaultSort="unsorted"
      />,
    );

    const profile = resourceCollectionProfile.mock.lastCall?.[0] as
      ResourceCollectionProfile<Record<string, unknown>> | undefined;
    // Passing only `columns` used to drop these, so PDB links, the detail panel and
    // the facets disappeared from the multi-genome Protein Structures tab.
    expect(profile?.detailFields?.length).toBeGreaterThan(0);
    expect(profile?.facets?.length).toBeGreaterThan(0);
    expect(profile?.rowLinkField).toBe("pdb_id");
    expect(profile?.rowHref?.({ pdb_id: "1ABC" })).toBe(
      "/protein-structure?accession=1ABC",
    );
    expect(profile?.basePredicate).toBe("eq(genome_id,83332.12)");
    // A facet click stays inside the parent scope instead of replacing it.
    expect(
      profile?.buildStructuralRql?.({
        filters: { method: ["X-Ray"] },
        page: 1,
        sort: "unsorted",
      }),
    ).toContain("eq(genome_id,83332.12)");
  });

  it("exports loaded-keyword matches from every page", async () => {
    useResourceCollection.mockReturnValue(
      realCollectionResult({
        rows: [
          { pdb_id: "1ABC", title: "Influenza A polymerase" },
          { pdb_id: "2DEF", title: "Unrelated structure" },
        ],
        total: 2,
      }),
    );
    exportAll.mockResolvedValueOnce({
      rows: [
        { pdb_id: "1ABC", title: "Influenza A polymerase" },
        { pdb_id: "2DEF", title: "Unrelated structure" },
        { pdb_id: "3GHI", title: "Later influenza structure" },
      ],
    });
    useRealResourceCollection.current = true;
    const download = spyOnDownload();

    render(
      <ResourceChildCollection
        resource="protein_structure"
        urlKey="structures"
        label="Protein Structures"
        idField="pdb_id"
        rql="eq(genome_id,83332.12)"
        defaultSort="unsorted"
        keywordMode="loaded"
        keywordValue="influenza"
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Real export all" }),
    );

    const content = await download.text();
    expect(content).toContain("Influenza A polymerase");
    expect(content).toContain("Later influenza structure");
    expect(content).not.toContain("Unrelated structure");
    expect(exportAll).toHaveBeenCalled();
  });

  it("leaves a selected-ID export unfiltered", async () => {
    selected.mockResolvedValueOnce({ rows: [{ pdb_id: "1ABC" }] });
    useResourceCollection.mockReturnValue(realCollectionResult());
    useRealResourceCollection.current = true;

    render(
      <ResourceChildCollection
        resource="protein_structure"
        urlKey="structures"
        label="Protein Structures"
        idField="pdb_id"
        rql="eq(genome_id,83332.12)"
        defaultSort="unsorted"
        keywordMode="loaded"
        keywordValue="influenza"
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Real export selected" }),
    );

    // Selected IDs are already exact, so the keyword must not narrow them further
    // and only the requested fields are fetched.
    await waitFor(() => {
      expect(selected).toHaveBeenCalledWith("protein_structure", {
        ids: ["1ABC"],
        fields: ["pdb_id"],
      });
    });
    expect(exportAll).not.toHaveBeenCalled();
  });

  it("omits sorting when exporting an unsorted child collection", async () => {
    const genome = {
      genome_id: "genome-1",
      genome_name: "Genome 1",
    } as GenomeViewRecord;
    useResourceCollection.mockReturnValue(realCollectionResult());
    useRealResourceCollection.current = true;

    render(<GenomeMember genome={genome} activeTab="domains" />);

    await userEvent.click(
      screen.getByRole("button", { name: "Real export all" }),
    );

    await waitFor(() => {
      expect(exportAll).toHaveBeenCalledWith(
        "protein_feature",
        expect.objectContaining({ sort: undefined }),
      );
    });
  });
});

describe("ResourceChildCollection export unification (plan item 14)", () => {
  // Deliberately distinct `id`/`label` pairs, so a header assertion actually
  // proves labels are used rather than coincidentally matching the id.
  const structureColumns = [
    { id: "pdb_id", label: "PDB Accession" },
    { id: "title", label: "Structure Title" },
  ];
  const suppliedStructureProfile: ResourceCollectionProfile<
    Record<string, unknown>
  > = {
    resource: "protein_structure",
    label: "Structures",
    idField: "pdb_id",
    columns: structureColumns,
  };
  // A formula-injection payload in a value column, to prove the shared guard
  // still applies once the child no longer runs its own copy of it.
  const rowsWithFormulaValue = [
    { pdb_id: "1ABC", title: "=cmd|' /C calc'!A1" },
  ];

  it("names the export after the tab label, not the resource id", async () => {
    exportAll.mockResolvedValueOnce({ rows: rowsWithFormulaValue });
    useResourceCollection.mockReturnValue(realCollectionResult());
    useRealResourceCollection.current = true;
    const download = spyOnDownload();

    render(
      <ResourceChildCollection
        resource="protein_structure"
        urlKey="structures"
        label="Structures"
        idField="pdb_id"
        rql="eq(genome_id,83332.12)"
        defaultSort="unsorted"
        profile={suppliedStructureProfile}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Real export all" }),
    );

    // Old behavior (`saveRows(..., label.toLowerCase())`): a child export keeps
    // the tab label, never the resource id, as its filename base.
    expect(await download.filename()).toBe("structures.csv");
  });

  it("produces a byte-identical CSV to the parent's own export, with display-label headers and formula-injection guarding", async () => {
    exportAll.mockResolvedValue({ rows: rowsWithFormulaValue });
    useResourceCollection.mockReturnValue(realCollectionResult());
    useRealResourceCollection.current = true;

    const childDownload = spyOnDownload();
    const { unmount } = render(
      <ResourceChildCollection
        resource="protein_structure"
        urlKey="structures"
        label="Structures"
        idField="pdb_id"
        rql="eq(genome_id,83332.12)"
        defaultSort="unsorted"
        profile={suppliedStructureProfile}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Real export all" }),
    );
    const childCsv = await childDownload.text();
    const childFilename = await childDownload.filename();
    unmount();

    const parentDownload = spyOnDownload();
    render(
      <ResourceCollection
        profile={suppliedStructureProfile}
        repository={{ exportAll, selected } as unknown as DataRepository}
        state={{ filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Real export all" }),
    );
    const parentCsv = await parentDownload.text();
    const parentFilename = await parentDownload.filename();

    const expectedCsv = [
      "PDB Accession,Structure Title",
      `"1ABC","'=cmd|' /C calc'!A1"`,
    ].join("\n");
    // Same columns, same rows, same serializer (`serializeResourceRows`): parent
    // and child produce byte-identical CSV bodies. Only the filename — the one
    // sanctioned override — is allowed to diverge.
    expect(childCsv).toBe(expectedCsv);
    expect(parentCsv).toBe(expectedCsv);
    expect(childFilename).toBe("structures.csv");
    expect(parentFilename).toBe("protein_structure.csv");
  });

  it("produces a byte-identical TSV to the parent's own export", async () => {
    exportAll.mockResolvedValue({
      rows: [{ pdb_id: "1ABC", title: "multi\nline" }],
    });
    useResourceCollection.mockReturnValue(realCollectionResult());
    useRealResourceCollection.current = true;

    const childDownload = spyOnDownload();
    const { unmount } = render(
      <ResourceChildCollection
        resource="protein_structure"
        urlKey="structures"
        label="Structures"
        idField="pdb_id"
        rql="eq(genome_id,83332.12)"
        defaultSort="unsorted"
        profile={suppliedStructureProfile}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Real export all TSV" }),
    );
    const childTsv = await childDownload.text();
    const childFilename = await childDownload.filename();
    unmount();

    const parentDownload = spyOnDownload();
    render(
      <ResourceCollection
        profile={suppliedStructureProfile}
        repository={{ exportAll, selected } as unknown as DataRepository}
        state={{ filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Real export all TSV" }),
    );
    const parentTsv = await parentDownload.text();
    const parentFilename = await parentDownload.filename();

    // Tabs and newlines inside a value are normalized to a single space, per
    // `exportValue` in resource-export.ts — proven here through the real
    // component tree rather than by calling the serializer directly.
    const expectedTsv = "PDB Accession\tStructure Title\n1ABC\tmulti line";
    expect(childTsv).toBe(expectedTsv);
    expect(parentTsv).toBe(expectedTsv);
    expect(childFilename).toBe("structures.txt");
    expect(parentFilename).toBe("protein_structure.txt");
  });

  it("propagates a supplied profile's non-default server keyword mode to exportAll", async () => {
    // Before plan item 14, the child's own onExport handler never passed
    // keywordMode at all, so an "exact" mode on a supplied profile was silently
    // dropped. Routing through ResourceCollection's exportRows fixes that.
    exportAll.mockResolvedValueOnce({ rows: [] });
    useResourceCollection.mockReturnValue(realCollectionResult());
    useRealResourceCollection.current = true;

    render(
      <ResourceChildCollection
        resource="protein_structure"
        urlKey="structures"
        label="Structures"
        idField="pdb_id"
        rql="eq(genome_id,83332.12)"
        defaultSort="unsorted"
        profile={{ ...suppliedStructureProfile, serverKeywordMode: "exact" }}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Real export all" }),
    );

    await waitFor(() => {
      expect(exportAll).toHaveBeenCalledWith(
        "protein_structure",
        expect.objectContaining({ keywordMode: "exact" }),
      );
    });
  });

  it("defaults to the prefix keyword contract for a canonical child branch that leaves serverKeywordMode unset", async () => {
    exportAll.mockResolvedValueOnce({ rows: [] });
    useResourceCollection.mockReturnValue(realCollectionResult());
    useRealResourceCollection.current = true;

    render(
      <ResourceChildCollection
        resource="bioset"
        urlKey="biosets"
        label="Biosets"
        idField="bioset_id"
        rql="eq(exp_id,experiment-1)"
        defaultSort="bioset_id:asc"
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Real export all" }),
    );

    await waitFor(() => {
      expect(exportAll).toHaveBeenCalledWith(
        "bioset",
        expect.objectContaining({ keywordMode: undefined }),
      );
    });
  });
});
