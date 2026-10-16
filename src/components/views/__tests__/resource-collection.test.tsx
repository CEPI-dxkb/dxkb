import { act, render, screen, waitFor } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import type { DataRepository } from "@/lib/data-api";
import type { DownloadRequest } from "@/lib/data-api/downloads";
import { featureCollectionProfile } from "@/lib/feature-view/profile";
import { genomeCollectionProfile } from "@/lib/genome-view/profile";
import { taxonomyCollectionProfile } from "@/lib/taxonomy-view/profile";
import type { CollectionState } from "@/lib/views/collection-state";
import type { useResourceCollection as useResourceCollectionHook } from "@/hooks/views/use-resource-collection";
import { ResourceCollection } from "../resource-collection";
import { writeStorageItem } from "@/lib/browser-storage";
import { jsdomLocalStorage } from "@/test-helpers/storage";
import { createUiPreferencesWrapper } from "@/test-helpers/react";
import { createResourceCollectionResult } from "./fixtures/resource-collection-result";

// Generic ResourceCollection behaviour: rendering the same profile across scopes,
// collection-load error/retry, keyword/filter modes (server, loaded, refine), what the
// Download tile is handed, and the table/detail rendering contracts. None
// of this depends on which resource is mounted, so `genomeCollectionProfile` stands in
// throughout (Taxonomy appears only in "error presentation", as the vehicle for the
// action-error sink). Selection, Taxonomy, Bioset and resource-navigation action tests
// live in their own `resource-collection-*-actions.test.tsx` files (plan item 21).

const { push, downloadResourceExport, useResourceCollection, collectionDownload } =
  vi.hoisted(() => ({
    push: vi.fn(),
    downloadResourceExport: vi.fn(),
    useResourceCollection: vi.fn<typeof useResourceCollectionHook>(),
    collectionDownload: vi.fn(),
  }));
let dataTableProps: Record<string, unknown>;
let actionBarProps: Record<string, unknown>;

vi.mock("next/navigation", async () =>
  (await import("./fixtures/resource-collection-mocks")).nextNavigationMock({
    push,
  }),
);
vi.mock("@tanstack/react-query", async () =>
  (await import("./fixtures/resource-collection-mocks")).reactQueryMock(),
);
vi.mock("@/hooks/views/use-collection-download", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).collectionDownloadMock(collectionDownload),
);
vi.mock("@/lib/auth/provider", async () =>
  (await import("./fixtures/resource-collection-mocks")).authProviderMock(),
);
vi.mock("@/contexts/workspace-repository-context", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).workspaceRepositoryContextMock(),
);
vi.mock("../collection-copy-dialog", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).collectionCopyDialogMock(),
);
vi.mock("../selection-service-chooser", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).selectionServiceChooserMock(),
);
vi.mock("@/components/workspace/selection-to-group-dialog", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).selectionToGroupDialogMock(),
);
vi.mock("../resource-export", async () =>
  (await import("./fixtures/resource-collection-mocks")).resourceExportMock(
    downloadResourceExport,
  ),
);
vi.mock("@/hooks/views/use-resource-collection", () => ({
  useResourceCollection,
}));
vi.mock("../resource-filter-bar", () => ({
  ResourceFilterBar: (props: Record<string, unknown>) => (
    <div
      data-testid="filter-bar"
      data-definitions={JSON.stringify(props.definitions)}
      data-keyword={typeof props.keyword === "string" ? props.keyword : ""}
      data-facets-loading={String(props.facetsLoading)}
      data-facets-refreshing={String(props.facetsRefreshing)}
      data-facets-error={
        typeof props.facetsError === "string" ? props.facetsError : ""
      }
      data-filters-beside-rql={JSON.stringify(props.filtersBesideRql ?? [])}
    >
      <button
        onClick={() => {
          (props.onRetryFacets as () => void)();
        }}
      >
        Retry facets
      </button>
      <button
        onClick={() => {
          const onChange = props.onChange as (update: {
            keyword?: string;
            filters: CollectionState["filters"];
          }) => void;
          onChange({ keyword: props.keyword as string | undefined, filters: {} });
        }}
      >
        Remove every chip
      </button>
      {["dna gy", "HUMAN", "absent", "N034", undefined].map((keyword) => (
        <button
          key={keyword ?? "clear"}
          onClick={() => {
            const onChange = props.onChange as (update: {
              keyword?: string;
              filters: CollectionState["filters"];
            }) => void;
            onChange({
              keyword,
              filters: props.filters as CollectionState["filters"],
            });
          }}
        >
          {keyword === "dna gy"
            ? "Filter loaded rows"
            : keyword === "HUMAN"
              ? "Filter array value"
              : keyword === "N034"
                ? "Refine server results"
                : keyword
                  ? "Filter no matches"
                  : "Clear loaded filter"}
        </button>
      ))}
    </div>
  ),
}));
// The `SearchActionBar` fake shared with every resource-collection*.test.tsx suite.
// It calls the same `visibleSearchActions` / `isSearchActionDisabled` policy
// production does (search-action-policy.ts), so a control this suite can query or
// click is one the real bar would have rendered, in the same enabled state.
vi.mock("@/components/search/search-action-bar", async () =>
  (await import("./fixtures/resource-collection-mocks")).searchActionBarMock(
    (props) => {
      actionBarProps = props;
    },
  ),
);
vi.mock("@/components/detail-panel/info-panel", async () =>
  (await import("./fixtures/resource-collection-mocks")).infoPanelMock(),
);
vi.mock("../taxonomy-service-chooser", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).taxonomyServiceChooserMock(),
);
vi.mock("../resource-workspace", async () =>
  (
    await import("./fixtures/resource-collection-mocks")
  ).flatResourceWorkspaceMock(),
);
vi.mock("@/components/shared/data-table", () => ({
  DataTable: (props: Record<string, unknown>) => {
    dataTableProps = props;
    const columns = props.columns as {
      id: string;
      href?: (row: Record<string, unknown>) => string | undefined;
    }[];
    const rows = props.data as Record<string, unknown>[];
    const linkColumn = columns.find((column) => column.href);
    return (
      <div data-testid="data-table">
        {linkColumn?.href && rows.length > 0 ? (
          <a href={linkColumn.href(rows[0])}>{String(rows[0].genome_name)}</a>
        ) : null}
      </div>
    );
  },
}));

const state: CollectionState = {
  keyword: "coli",
  filters: { genome_status: ["Complete"] },
  page: 3,
  sort: "genome_length:desc",
};
const row = {
  genome_id: "83332.12",
  genome_name: "E. coli fixture",
  genome_length: 1234,
};

function collectionResult(
  overrides: Partial<ReturnType<typeof useResourceCollectionHook>> = {},
) {
  return createResourceCollectionResult({
    activeId: "83332.12",
    detail: row,
    facets: { genome_status: [{ value: "Complete", count: 1 }] },
    rows: [row],
    selection: { "83332.12": true },
    selectedIds: ["83332.12"],
    sorting: [{ id: "genome_length", desc: true }],
    total: 1,
    ...overrides,
  });
}

function repository(
  exportResult: Promise<unknown> = Promise.resolve({ rows: [row] }),
) {
  return {
    exportAll: vi.fn(() => exportResult),
    selected: vi.fn(() => exportResult),
  } as unknown as DataRepository;
}

beforeEach(() => {
  useResourceCollection.mockReturnValue(collectionResult());
  // A subclass rather than a spread, so `URL` stays constructible: jsdom's
  // cookie jar builds one when the UI-preferences provider clears old cookies.
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => "blob:test");
      static revokeObjectURL = vi.fn();
    },
  );
});

afterEach(() => vi.unstubAllGlobals());

/** Open the rail's Download tile, and pick `format` when one is given. */
async function downloadFromTile(
  user: ReturnType<typeof userEvent.setup>,
  format?: string,
) {
  await user.click(screen.getByRole("button", { name: /^DOWNLOAD/ }));
  if (format)
    await user.click(await screen.findByRole("button", { name: format }));
}

/** `collectionResult()` with nothing selected and no detail row. */
const unselected: Partial<ReturnType<typeof useResourceCollectionHook>> = {
  activeId: null,
  detail: null,
  selection: {},
  selectedIds: [],
};

// `genomeCollectionProfile` stands in for "any resource" throughout this block; none
// of these assertions are Genome-specific. Renamed from "Genome integration contracts"
// (plan item 21) now that the resource-specific action tests that name lumped
// together have moved to their own files.
describe("ResourceCollection generic collection, export and filter behaviour", () => {
  // Plan item 27: `showHeader` (and its heading/aria-labelledby branch) is gone
  // because every production caller always passed `showHeader={false}` — this
  // pins the one surviving arm so the accessible name doesn't regress.
  it("labels the collection region from the profile with no rendered heading", () => {
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
      />,
    );
    // The COMPUTED accessible name, not the attribute that happens to produce
    // it today: `getByRole` also fails if the region is hidden (`aria-hidden`,
    // `display: none`) or given a competing label on a wrapper, neither of
    // which a `toHaveAttribute("aria-label", …)` check can see.
    const section = screen.getByRole("region", { name: "Genomes" });
    expect(section).not.toHaveAttribute("aria-labelledby");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByText("Field guide")).not.toBeInTheDocument();
  });

  it("keeps global and taxon-scoped views on the same profile and interaction surface", () => {
    const global = render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
      />,
    );
    const globalHookOptions = useResourceCollection.mock.calls.at(-1)?.[0];
    if (!globalHookOptions) throw new Error("Collection hook was not called");
    const globalTable = dataTableProps;
    const globalActions = actionBarProps;
    const globalFacets = screen.getByTestId("filter-bar").dataset.definitions;
    expect(screen.getByTestId("detail")).toHaveTextContent("E. coli fixture");
    global.unmount();

    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
        baseRql="eq(taxon_lineage_ids,561)"
      />,
    );
    const scopedHookOptions = useResourceCollection.mock.calls.at(-1)?.[0];

    expect(scopedHookOptions).toMatchObject({
      resource: globalHookOptions.resource,
      idField: globalHookOptions.idField,
      fields: globalHookOptions.fields,
      detailFields: globalHookOptions.detailFields,
      facetFields: globalHookOptions.facetFields,
      structuralRql:
        "and(eq(taxon_lineage_ids,561),eq(genome_status,Complete))",
    });
    expect(dataTableProps).toMatchObject({
      columns: globalTable.columns,
      pageIndex: globalTable.pageIndex,
      pageSize: globalTable.pageSize,
      sorting: globalTable.sorting,
      onPageChange: globalTable.onPageChange,
      onSortingChange: globalTable.onSortingChange,
    });
    expect(actionBarProps).toMatchObject({
      searchType: globalActions.searchType,
      selectedCount: globalActions.selectedCount,
    });
    expect(screen.getByTestId("filter-bar").dataset.definitions).toBe(
      globalFacets,
    );
    expect(screen.getByTestId("detail")).toHaveTextContent("E. coli fixture");
  });

  it("preserves collection errors and supports retry", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    const message = "Genome service unavailable";
    useResourceCollection.mockReturnValueOnce({
      ...collectionResult(),
      error: new Error(message),
      refetch,
    });

    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(message);

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("reads an unsorted collection in the profile's unsorted order, with current rows", () => {
    const unsortedOrder = {
      field: "genome_name",
      direction: "asc",
      then: [{ field: "genome_id", direction: "asc" }],
    } as const;
    render(
      <ResourceCollection
        profile={{ ...genomeCollectionProfile, unsortedOrder }}
        repository={repository()}
        state={{ keyword: "", filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
      />,
    );

    expect(useResourceCollection.mock.calls.at(-1)?.[0]).toMatchObject({
      unsortedOrder,
    });
    // The rows on screen are this query's, so the table shows no refresh.
    expect(dataTableProps.isRefreshing).toBe(false);
  });

  it("shows full-detail errors instead of a partial row", () => {
    useResourceCollection.mockReturnValueOnce({
      ...collectionResult(),
      detailError: new Error("Genome detail service unavailable"),
    });
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Could not load record details")).toBeVisible();
    expect(screen.getByText("Genome detail service unavailable")).toBeVisible();
    expect(screen.queryByTestId("detail")).not.toBeInTheDocument();
  });

  it("updates collection state when the server keyword changes", async () => {
    const onStateChange = vi.fn();

    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={onStateChange}
        keywordMode="server"
      />,
    );

    expect(screen.getByTestId("filter-bar")).toHaveAttribute(
      "data-keyword",
      "coli",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Filter loaded rows" }),
    );

    expect(onStateChange).toHaveBeenCalledWith({
      ...state,
      keyword: "dna gy",
      page: 1,
    });
  });

  it("filters loaded rows without changing the server query or collection state", async () => {
    const onStateChange = vi.fn();
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      rows: [
        row,
        {
          genome_id: "83332.13",
          genome_name: "DNA gyrase fixture",
          genome_length: 5678,
        },
      ],
      selection: {},
      selectedIds: [],
      total: 2,
    });

    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={onStateChange}
        keywordMode="loaded"
      />,
    );

    expect(screen.getByTestId("filter-bar")).toHaveAttribute(
      "data-keyword",
      "",
    );
    const initialHookOptions = useResourceCollection.mock.calls.at(-1)?.[0];
    expect(initialHookOptions?.state.keyword).toBeUndefined();

    await userEvent.click(
      screen.getByRole("button", { name: "Filter loaded rows" }),
    );

    await waitFor(() => {
      expect(dataTableProps.data).toEqual([
        {
          genome_id: "83332.13",
          genome_name: "DNA gyrase fixture",
          genome_length: 5678,
        },
      ]);
    });
    expect(dataTableProps.totalItems).toBe(1);
    expect(dataTableProps.pageIndex).toBe(0);
    expect(onStateChange).not.toHaveBeenCalled();
    const hookOptions = useResourceCollection.mock.calls.at(-1)?.[0];
    expect(hookOptions?.state.keyword).toBeUndefined();
    hookOptions?.onStateChange({ ...state, keyword: undefined, page: 4 });
    expect(onStateChange).toHaveBeenCalledWith({ ...state, page: 4 });

    await userEvent.click(
      screen.getByRole("button", { name: "Clear loaded filter" }),
    );

    await waitFor(() => {
      expect(dataTableProps.data).toHaveLength(2);
    });
    expect(dataTableProps.totalItems).toBe(2);
    expect(dataTableProps.pageIndex).toBe(2);
    expect(onStateChange).toHaveBeenCalledTimes(1);
  });

  // The Feature list keeps its PATRIC default and its feature-type scope beside
  // a link's rql (`filtersBesideRql`), so the user can remove either chip
  // without losing the link's scope.
  it("applies a chip removal beside an explicit rql to the filters it keeps", async () => {
    const onStateChange = vi.fn();
    useResourceCollection.mockReturnValue(collectionResult());
    const linked: CollectionState = {
      ...state,
      rql: "eq(genome_id,83332.12)",
      filters: { annotation: ["PATRIC"], filter: ["CDS"] },
    };
    const { rerender } = render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={linked}
        onStateChange={onStateChange}
        filtersBesideRql={["annotation", "filter"]}
      />,
    );
    expect(screen.getByTestId("filter-bar")).toHaveAttribute(
      "data-filters-beside-rql",
      JSON.stringify(["annotation", "filter"]),
    );

    await userEvent.click(screen.getByRole("button", { name: "Remove every chip" }));
    expect(onStateChange).toHaveBeenLastCalledWith({
      ...linked,
      filters: {},
      page: 1,
    });

    // A filter the rql does not keep stays as it is until the rql is cleared.
    rerender(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={linked}
        onStateChange={onStateChange}
        filtersBesideRql={["annotation"]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove every chip" }));
    expect(onStateChange).toHaveBeenLastCalledWith({
      ...linked,
      filters: { filter: ["CDS"] },
      page: 1,
    });

    rerender(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={linked}
        onStateChange={onStateChange}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove every chip" }));
    expect(onStateChange).toHaveBeenLastCalledWith({ ...linked, page: 1 });
  });

  it("refines the server query while preserving the primary keyword in URL state", async () => {
    const onStateChange = vi.fn();
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      rows: [
        row,
        { genome_id: "83332.13", genome_name: "Unmatched current-page row" },
      ],
      total: 160,
    });

    const refinedState = {
      ...state,
      keyword: "influenza",
      refine: "existing refinement",
    };
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={refinedState}
        onStateChange={onStateChange}
        keywordMode="refine"
      />,
    );

    expect(screen.getByTestId("filter-bar")).toHaveAttribute(
      "data-keyword",
      "existing refinement",
    );
    expect(useResourceCollection.mock.calls.at(-1)?.[0]).toMatchObject({
      structuralRql:
        "and(eq(genome_status,Complete),and(keyword(existing),keyword(refinement)))",
      state: { keyword: "influenza" },
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Refine server results" }),
    );

    expect(onStateChange).toHaveBeenCalledWith({
      ...refinedState,
      refine: "N034",
      page: 1,
    });
    expect(dataTableProps.data).toHaveLength(2);
    expect(dataTableProps.totalItems).toBe(160);
  });

  // Loaded mode filters the current page for display, but an export must refetch
  // the complete source set and apply the same filter so later-page matches are
  // included.
  it("clears hidden selections and downloads only the rows a loaded keyword leaves", async () => {
    const user = userEvent.setup();
    const laterMatch = {
      genome_id: "83332.14",
      genome_name: "DNA gyrase from a later page",
      genome_length: 9012,
    };
    const data = repository(
      Promise.resolve({
        rows: [
          row,
          {
            genome_id: "83332.13",
            genome_name: "DNA gyrase fixture",
            genome_length: 5678,
          },
          laterMatch,
        ],
      }),
    );
    const selected = vi.spyOn(data, "selected");
    const exportAll = vi.spyOn(data, "exportAll");
    const setSelection = vi.fn();
    const setIsAllPagesSelected = vi.fn();
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      rows: [
        row,
        {
          genome_id: "83332.13",
          genome_name: "DNA gyrase fixture",
          genome_length: 5678,
        },
      ],
      selection: { "83332.12": true, "83332.13": true },
      selectedIds: ["83332.12", "83332.13"],
      total: 401,
      setSelection,
      setIsAllPagesSelected,
    });

    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={data}
        state={state}
        onStateChange={vi.fn()}
        keywordMode="loaded"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Filter loaded rows" }),
    );

    await waitFor(() => {
      expect(dataTableProps.data).toEqual([
        {
          genome_id: "83332.13",
          genome_name: "DNA gyrase fixture",
          genome_length: 5678,
        },
      ]);
    });
    expect(setSelection).toHaveBeenCalledWith({});
    expect(setIsAllPagesSelected).toHaveBeenCalledWith(false);
    expect(dataTableProps).toMatchObject({
      rowSelection: { "83332.13": true },
      selectedIds: ["83332.13"],
      isAllPagesSelected: false,
      totalSelectedCount: 1,
    });
    expect(actionBarProps.selectedCount).toBe(1);

    // A loaded keyword filters the loaded page only, so *All results* is the rows
    // it leaves, by id, rather than a query the keyword is not part of.
    await downloadFromTile(user);
    await user.click(screen.getByRole("radio", { name: /^All/ }));
    await user.click(screen.getByRole("button", { name: "CSV" }));
    expect(collectionDownload).toHaveBeenLastCalledWith(
      "genome",
      expect.objectContaining({
        scope: { kind: "selected", ids: ["83332.13"] },
        fileNameBase: "genome",
        total: 1,
      }),
      expect.anything(),
    );
    expect(screen.getByText("keyword: dna gy")).toBeVisible();
    expect(exportAll).not.toHaveBeenCalled();
    expect(selected).not.toHaveBeenCalled();
    expect(downloadResourceExport).not.toHaveBeenCalled();
  });

  it("matches array values case-insensitively and handles no local matches", async () => {
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      rows: [
        { ...row, host_name: ["Homo sapiens", "Human"] },
        {
          genome_id: "83332.13",
          genome_name: "DNA gyrase fixture",
          genome_length: 5678,
        },
      ],
      selection: {},
      selectedIds: [],
      total: 2,
    });

    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
        keywordMode="loaded"
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Filter array value" }),
    );
    await waitFor(() => {
      expect(dataTableProps.data).toEqual([
        { ...row, host_name: ["Homo sapiens", "Human"] },
      ]);
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Filter no matches" }),
    );
    await waitFor(() => {
      expect(dataTableProps.data).toEqual([]);
    });
    expect(dataTableProps.totalItems).toBe(0);
  });

  it("omits the URL keyword from loaded-mode collection requests", () => {
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
        keywordMode="loaded"
      />,
    );

    const hookOptions = useResourceCollection.mock.calls.at(-1)?.[0];
    expect(hookOptions?.state.keyword).toBeUndefined();
    expect(screen.getByTestId("filter-bar")).toHaveAttribute(
      "data-keyword",
      "",
    );
  });

  it("prefetches the next page unless a caller opts out", () => {
    const { rerender } = render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
      />,
    );
    expect(useResourceCollection.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ prefetchNextPage: true }),
    );

    rerender(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
        prefetchNextPage={false}
      />,
    );
    expect(useResourceCollection.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ prefetchNextPage: false }),
    );
  });

  it("hands the filter bar the facet states, the facet error's own message, and its retry", async () => {
    const user = userEvent.setup();
    const refetchFacets = vi.fn();
    useResourceCollection.mockReturnValue(
      collectionResult({
        isFacetsLoading: true,
        isFacetsRefreshing: true,
        facetsError: new Error("Facet query timed out upstream."),
        refetchFacets,
      }),
    );

    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    const filterBar = screen.getByTestId("filter-bar");
    expect(filterBar).toHaveAttribute("data-facets-loading", "true");
    expect(filterBar).toHaveAttribute("data-facets-refreshing", "true");
    expect(filterBar).toHaveAttribute(
      "data-facets-error",
      "Facet query timed out upstream.",
    );
    await user.click(screen.getByRole("button", { name: "Retry facets" }));
    expect(refetchFacets).toHaveBeenCalledOnce();
  });

  it("names what failed when the facet error has no message of its own", () => {
    useResourceCollection.mockReturnValue(
      collectionResult({ facetsError: new Error("   ") }),
    );

    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("filter-bar")).toHaveAttribute(
      "data-facets-error",
      "The filter values could not be loaded. Please try again.",
    );
  });

  it("shows the table's loading skeleton while a page that was not prefetched loads", () => {
    useResourceCollection.mockReturnValue(
      collectionResult({ isPlaceholderData: true, isPageLoading: true }),
    );

    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    expect(dataTableProps.isLoading).toBe(true);
    // The previous page's total keeps the pager in place meanwhile.
    expect(dataTableProps.totalItems).toBe(1);
  });

  it("keeps the data table mounted when no rows are available", () => {
    useResourceCollection.mockReturnValueOnce({
      ...collectionResult(),
      activeId: null,
      detail: null,
      rows: [],
      selection: {},
      selectedIds: [],
      total: 0,
    });

    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={{ ...state, keyword: "", filters: {}, page: 1 }}
        onStateChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("data-table")).toBeInTheDocument();
    expect(dataTableProps).toMatchObject({ data: [], totalItems: 0 });
  });
});

describe("ResourceCollection Download tile", () => {
  const plainProfile = {
    resource: "genome" as const,
    label: "Genomes",
    idField: "genome_id",
    basePredicate: "eq(genome_id,*)",
    columns: [
      { id: "genome_id", label: "Genome ID" },
      { id: "genome_name", label: "Genome Name" },
      { id: "genome_length", label: "Length", visible: false },
    ],
  };

  it("downloads the query on screen as All results when nothing is selected", async () => {
    const user = userEvent.setup();
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      ...unselected,
      total: 401,
    });

    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    await downloadFromTile(user, "CSV");
    expect(collectionDownload).toHaveBeenCalledWith(
      "genome",
      {
        format: "csv",
        scope: {
          kind: "query",
          rql: "eq(genome_status,Complete)",
          keyword: "coli",
          keywordMode: undefined,
        },
        sort: { field: "genome_length", direction: "desc" },
        fields: undefined,
        fileNameBase: "genome",
        total: 401,
      },
      expect.anything(),
    );
    expect(screen.getByText("keyword: coli")).toBeVisible();
  });

  it("sends the effective rql, the profile's keyword mode and its exportFileName", async () => {
    const user = userEvent.setup();
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      ...unselected,
      total: 3,
    });

    render(
      <ResourceCollection
        profile={{
          ...plainProfile,
          serverKeywordMode: "exact",
          exportFileName: "genomes tab",
        }}
        repository={repository()}
        state={{
          keyword: "coli",
          rql: "eq(genome_name,x)",
          filters: {},
          page: 1,
          sort: "unsorted",
        }}
        onStateChange={vi.fn()}
      />,
    );

    await downloadFromTile(user, "Text");
    expect(collectionDownload).toHaveBeenCalledWith(
      "genome",
      expect.objectContaining({
        format: "tsv",
        scope: {
          kind: "query",
          rql: "and(eq(genome_id,*),eq(genome_name,x))",
          keyword: "coli",
          keywordMode: "exact",
        },
        // Unsorted: the gateway falls back to the primary key.
        sort: undefined,
        fileNameBase: "genomes tab",
      }),
      expect.anything(),
    );
  });

  it("downloads an unsorted collection in the profile's unsorted order", async () => {
    const user = userEvent.setup();
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      ...unselected,
      total: 3,
    });
    const unsortedOrder = {
      field: "genome_name",
      direction: "asc",
      then: [{ field: "genome_id", direction: "asc" }],
    } as const;

    render(
      <ResourceCollection
        profile={{ ...plainProfile, unsortedOrder }}
        repository={repository()}
        state={{ filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
      />,
    );

    await downloadFromTile(user, "CSV");
    expect(collectionDownload).toHaveBeenCalledWith(
      "genome",
      expect.objectContaining({ sort: unsortedOrder }),
      expect.anything(),
    );
  });

  it("downloads an all-pages selection as the query, named as a selection", async () => {
    const user = userEvent.setup();
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      ...unselected,
      isAllPagesSelected: true,
      total: 2,
    });

    render(
      <ResourceCollection
        profile={plainProfile}
        repository={repository()}
        state={{ filters: {}, page: 1, sort: "genome_id:asc" }}
        onStateChange={vi.fn()}
      />,
    );

    // The badge counts every matching row.
    expect(screen.getByRole("button", { name: /^DOWNLOAD/ })).toHaveTextContent(
      "DOWNLOAD2",
    );
    await downloadFromTile(user, "Excel");
    expect(collectionDownload).toHaveBeenCalledWith(
      "genome",
      expect.objectContaining({
        format: "xlsx",
        fileNameBase: "genome-selected",
        total: 2,
      }),
      expect.anything(),
    );
    expect(
      (collectionDownload.mock.lastCall as [string, DownloadRequest])[1].scope,
    ).toMatchObject({ kind: "query" });
  });

  it("sends the visible columns for table formats only", async () => {
    const user = userEvent.setup();

    render(
      <ResourceCollection
        profile={plainProfile}
        repository={repository()}
        state={{ filters: {}, page: 1, sort: "genome_id:asc" }}
        onStateChange={vi.fn()}
      />,
    );

    await downloadFromTile(user);
    await user.click(screen.getByRole("switch", { name: "Visible columns" }));
    await user.click(screen.getByRole("button", { name: "CSV" }));
    expect(collectionDownload).toHaveBeenLastCalledWith(
      "genome",
      expect.objectContaining({
        scope: { kind: "selected", ids: ["83332.12"] },
        fields: ["genome_id", "genome_name"],
      }),
      expect.anything(),
    );
    await user.click(screen.getByRole("button", { name: "DNA FASTA" }));
    expect(collectionDownload).toHaveBeenLastCalledWith(
      "genome",
      expect.objectContaining({ format: "dna-fasta", fields: undefined }),
      expect.anything(),
    );
  });

  it("holds All results while the count belongs to a previous query", async () => {
    const user = userEvent.setup();
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      ...unselected,
      isPlaceholderData: true,
      total: 50,
    });

    render(
      <ResourceCollection
        profile={plainProfile}
        repository={repository()}
        state={{ filters: {}, page: 1, sort: "genome_id:asc" }}
        onStateChange={vi.fn()}
      />,
    );

    // The previous query's rows stay on screen, marked as refreshing.
    expect(dataTableProps.isRefreshing).toBe(true);
    await downloadFromTile(user);
    expect(screen.getByRole("radio", { name: /^All/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    const csv = screen.getByRole("button", { name: /^CSV/ });
    expect(csv).toBeDisabled();
    expect(csv).toHaveTextContent("Counting matching rows…");
  });

  it("offers each resource's sequence formats, narrowed by the view", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
      />,
    );
    await downloadFromTile(user);
    // A genome's DNA is every contig it has.
    expect(screen.getByRole("button", { name: "DNA FASTA" })).toHaveAttribute(
      "title",
      "Nucleotide sequences. Contigs of each genome.",
    );
    expect(
      screen.queryByRole("button", { name: "Protein FASTA" }),
    ).not.toBeInTheDocument();
    unmount();

    const featureState = {
      filters: { filter: ["protein"] },
      page: 1,
      sort: "unsorted",
    };
    const { rerender } = render(
      <ResourceCollection
        profile={featureCollectionProfile}
        repository={repository()}
        state={featureState}
        onStateChange={vi.fn()}
      />,
    );
    await downloadFromTile(user);
    // The Proteins search offers Protein FASTA only.
    expect(screen.getByRole("button", { name: "Protein FASTA" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "DNA FASTA" }),
    ).not.toBeInTheDocument();

    rerender(
      <ResourceCollection
        profile={featureCollectionProfile}
        repository={repository()}
        state={{ ...featureState, filters: {} }}
        onStateChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "DNA FASTA" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Protein FASTA" })).toBeVisible();
  });

  it("turns the table's own download controls off", () => {
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    expect(dataTableProps).toMatchObject({ showExportControls: false });
    expect(dataTableProps.onDownloadAll).toBeUndefined();
    expect(dataTableProps.onDownloadSelected).toBeUndefined();
  });
});

describe("ResourceCollection error presentation", () => {
  it("falls back to a readable message when the collection load fails with an empty Error", () => {
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      error: new Error("   "),
    });

    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    // The alert renders on the `error` object, so a blank message left a
    // bordered destructive region with no text in it for a screen reader.
    expect(screen.getByText("Could not load genomes")).toBeVisible();
    expect(
      screen.getByText(
        "The requested records could not be loaded. Please try again.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  it("falls back to a readable message when the collection load rejects with a non-Error", () => {
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      error: { status: 502 } as unknown as Error,
    });

    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        "The requested records could not be loaded. Please try again.",
      ),
    ).toBeVisible();
    // `String(error)` used to put this in front of the user.
    expect(screen.queryByText("[object Object]")).not.toBeInTheDocument();
  });

  it("falls back to a readable message when an action fails with an empty Error", async () => {
    const user = userEvent.setup();
    const taxonomyRow = { taxon_id: "234", taxon_name: "Brucella" };
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      activeId: "234",
      detail: taxonomyRow,
      rows: [taxonomyRow],
      selection: {},
      selectedIds: [],
      isAllPagesSelected: true,
      total: 3,
      sorting: [],
    });

    render(
      <ResourceCollection
        profile={taxonomyCollectionProfile}
        repository={
          {
            selected: vi.fn(() => Promise.resolve({ rows: [] })),
            exportAll: vi.fn(() => Promise.reject(new Error(" "))),
          } as unknown as DataRepository
        }
        state={{ filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
      />,
    );

    // The in-page services dialog path, so no tab is reserved.
    await user.click(screen.getByRole("button", { name: "services" }));
    expect(
      await screen.findByText(
        "The requested action could not be completed. Please try again.",
      ),
    ).toBeVisible();
    expect(screen.getByText("Could not complete action")).toBeVisible();
  });

  it("falls back to a readable message when an action rejects with a non-Error", async () => {
    const user = userEvent.setup();
    const taxonomyRow = { taxon_id: "234", taxon_name: "Brucella" };
    useResourceCollection.mockReturnValue({
      ...collectionResult(),
      activeId: "234",
      detail: taxonomyRow,
      rows: [taxonomyRow],
      selection: {},
      selectedIds: [],
      isAllPagesSelected: true,
      total: 3,
      sorting: [],
    });
    const close = vi.fn();
    vi.stubGlobal(
      "open",
      vi.fn(() => ({ opener: window, location: { replace: vi.fn() }, close })),
    );

    render(
      <ResourceCollection
        profile={taxonomyCollectionProfile}
        repository={
          {
            selected: vi.fn(() => Promise.resolve({ rows: [] })),
            // A rejected string, not an Error — the shape a thrown response
            // body or a non-Error library rejection arrives in.
            exportAll: vi.fn().mockRejectedValue("gateway reset"),
          } as unknown as DataRepository
        }
        state={{ filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Genomes action" }));
    expect(
      await screen.findByText(
        "The requested action could not be completed. Please try again.",
      ),
    ).toBeVisible();
    expect(screen.queryByText("gateway reset")).not.toBeInTheDocument();
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe("ResourceCollection column layout", () => {
  const storageKey = "dxkb-table-layout:v1:collection:genome";
  const shownByDefault = genomeCollectionProfile.columns.find(
    (column) => column.visible !== false,
  );
  if (!shownByDefault) throw new Error("fixture needs a default-visible column");

  beforeEach(() => {
    vi.stubGlobal("localStorage", jsdomLocalStorage());
    localStorage.clear();
  });

  // browser-storage keeps a refused write in module state; a successful write to the
  // key is what clears it, so do that once storage works again.
  afterEach(() => {
    vi.stubGlobal("localStorage", jsdomLocalStorage());
    writeStorageItem(storageKey, null);
  });

  it("hides the columns the user hid on an earlier visit", () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ visibility: { [shownByDefault.id]: false } }),
    );
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
      />,
    );
    expect(dataTableProps.columnVisibility).toMatchObject({
      [shownByDefault.id]: false,
    });
  });

  it("saves only the difference from the profile defaults", () => {
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
      />,
    );
    const change = dataTableProps.onColumnVisibilityChange as (
      next: Record<string, boolean>,
    ) => void;
    act(() => {
      change({
        ...(dataTableProps.columnVisibility as Record<string, boolean>),
        [shownByDefault.id]: false,
      });
    });
    expect(JSON.parse(localStorage.getItem(storageKey) ?? "null")).toStrictEqual({
      visibility: { [shownByDefault.id]: false },
    });
  });

  it("starts the table at the widths saved on an earlier visit", () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ widths: { [shownByDefault.id]: 321 } }),
    );
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
      />,
    );
    expect(dataTableProps.savedColumnWidths).toStrictEqual({
      [shownByDefault.id]: 321,
    });
  });

  it("saves a finished resize next to the widths already saved", () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ widths: { earlier_column: 200 } }),
    );
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
      />,
    );
    const commit = dataTableProps.onColumnWidthsCommit as (
      widths: Record<string, number>,
    ) => void;
    act(() => {
      commit({ [shownByDefault.id]: 250 });
    });
    expect(JSON.parse(localStorage.getItem(storageKey) ?? "null")).toStrictEqual({
      widths: { earlier_column: 200, [shownByDefault.id]: 250 },
    });
  });

  it("still applies a column toggle when storage refuses the write", () => {
    const workingStorage = jsdomLocalStorage();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => workingStorage.getItem(key),
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    });
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
      />,
    );
    const change = dataTableProps.onColumnVisibilityChange as (
      next: Record<string, boolean>,
    ) => void;
    act(() => {
      change({
        ...(dataTableProps.columnVisibility as Record<string, boolean>),
        [shownByDefault.id]: false,
      });
    });
    expect(dataTableProps.columnVisibility).toMatchObject({
      [shownByDefault.id]: false,
    });
    expect(workingStorage.getItem(storageKey)).toBeNull();
  });

  it("requests no facet counts while the filter panel is closed", () => {
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    expect(useResourceCollection.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ facetFields: [] }),
    );
  });

  it("requests counts only for the facets the open filter panel shows", () => {
    const facetsShownByDefault = (genomeCollectionProfile.facets ?? []).filter(
      (facet) => facet.initiallyVisible !== false,
    );
    const collapsedByUser = facetsShownByDefault.at(0);
    if (!collapsedByUser) throw new Error("fixture needs a default-visible facet");
    const stillShown = facetsShownByDefault.slice(1);
    localStorage.setItem(
      storageKey,
      JSON.stringify({ facets: { [collapsedByUser.field]: false } }),
    );

    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
      />,
      { wrapper: createUiPreferencesWrapper({ facetPanelOpen: true }) },
    );

    expect(useResourceCollection.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        facetFields: stillShown.map((facet) => facet.field),
      }),
    );
  });

  it("waits for the saved facet set before requesting counts, showing placeholders meanwhile", () => {
    const facetsShownByDefault = (genomeCollectionProfile.facets ?? []).filter(
      (facet) => facet.initiallyVisible !== false,
    );
    const collapsedByUser = facetsShownByDefault.at(0);
    if (!collapsedByUser) throw new Error("fixture needs a default-visible facet");
    localStorage.setItem(
      storageKey,
      JSON.stringify({ facets: { [collapsedByUser.field]: false } }),
    );
    const Wrapper = createUiPreferencesWrapper({ facetPanelOpen: true });
    const tree = (
      <Wrapper>
        <ResourceCollection
          profile={genomeCollectionProfile}
          repository={repository()}
          state={state}
          onStateChange={vi.fn()}
        />
      </Wrapper>
    );

    // Server HTML first (storage reads as empty there), then hydrate it, which
    // is the render pair a full page load goes through.
    const container = document.createElement("div");
    document.body.append(container);
    container.innerHTML = renderToString(tree);
    // Before the saved set is known, a request would count the collapsed facet.
    expect(
      useResourceCollection.mock.calls.map(([options]) => options.facetFields),
    ).toEqual([[]]);
    expect(
      container.querySelector('[data-testid="filter-bar"]'),
    ).toHaveAttribute("data-facets-loading", "true");

    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      act(() => {
        root = hydrateRoot(container, tree);
      });

      expect(
        useResourceCollection.mock.calls.every(
          ([options]) =>
            !options.facetFields?.includes(collapsedByUser.field),
        ),
      ).toBe(true);
      expect(useResourceCollection.mock.calls.at(-1)?.[0].facetFields).toEqual(
        facetsShownByDefault.slice(1).map((facet) => facet.field),
      );
      expect(screen.getByTestId("filter-bar")).toHaveAttribute(
        "data-facets-loading",
        "false",
      );
    } finally {
      act(() => {
        root?.unmount();
      });
      container.remove();
    }
  });
});

describe("ResourceCollection facet state", () => {
  it("reads facet counts for facetState while the rows keep state", () => {
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        facetState={{ ...state, filters: {} }}
        onStateChange={vi.fn()}
        baseRql="eq(taxon_lineage_ids,561)"
      />,
    );

    expect(useResourceCollection.mock.calls.at(-1)?.[0]).toMatchObject({
      structuralRql: "and(eq(taxon_lineage_ids,561),eq(genome_status,Complete))",
      facetScope: {
        structuralRql: "and(eq(taxon_lineage_ids,561),eq(genome_id,*))",
      },
    });
  });

  it("reads facet counts for the rows' own scope by default", () => {
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={repository()}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    expect(useResourceCollection.mock.calls.at(-1)?.[0]?.facetScope).toBeUndefined();
  });
});
