import { act, render, screen, waitFor } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import type { DataRepository } from "@/lib/data-api";
import { maxSelectedRows } from "@/lib/data-api/validation";
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
// collection-load error/retry, keyword/filter modes (server, loaded, refine), export
// routing and its error presentation, and the table/detail rendering contracts. None
// of this depends on which resource is mounted, so `genomeCollectionProfile` stands in
// throughout (Taxonomy appears only in "error presentation", as the vehicle for the
// action-error sink). Selection, Taxonomy, Bioset and resource-navigation action tests
// live in their own `resource-collection-*-actions.test.tsx` files (plan item 21).

const { push, downloadResourceExport, useResourceCollection } = vi.hoisted(
  () => ({
    push: vi.fn(),
    downloadResourceExport: vi.fn(),
    useResourceCollection: vi.fn<typeof useResourceCollectionHook>(),
  }),
);
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
    >
      <button
        onClick={() => {
          (props.onRetryFacets as () => void)();
        }}
      >
        Retry facets
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
        <button
          onClick={() =>
            void (
              props.onDownloadAll as (
                format: "csv",
                fields: null,
              ) => Promise<void>
            )("csv", null)
          }
        >
          Export all
        </button>
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

  it("routes action-bar downloads through export-all for an all-pages selection", async () => {
    const user = userEvent.setup();
    const data = repository();
    const exportAll = vi.spyOn(data, "exportAll");
    useResourceCollection.mockReturnValueOnce({
      ...collectionResult(),
      activeId: null,
      detail: null,
      isAllPagesSelected: true,
      selection: {},
      selectedIds: [],
      total: 2,
    });

    render(
      <ResourceCollection
        // The Genome profile's columns, facets and sort, pointed at a resource whose
        // action bar actually offers DWNLD: `download` is not in the `genome` entry's
        // `validSearchTypes`, so a Genome collection downloads from the table. The
        // request shape under test belongs to the shell, not to either resource.
        profile={{ ...genomeCollectionProfile, resource: "genome_feature" }}
        repository={data}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Download action" }));

    expect(exportAll).toHaveBeenCalledWith("genome_feature", {
      rql: "eq(genome_status,Complete)",
      keyword: "coli",
      fields: genomeCollectionProfile.columns.map((column) => column.id),
      sort: { field: "genome_length", direction: "desc" },
    });
  });

  it("requests all matching rows using the active scope, sort, and columns", async () => {
    const data = repository();
    const exportAll = vi.spyOn(data, "exportAll");
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={data}
        state={state}
        onStateChange={vi.fn()}
        baseRql="eq(taxon_lineage_ids,561)"
        keywordMode="server"
      />,
    );

    await act(async () => {
      await (
        dataTableProps.onDownloadAll as (
          format: "csv",
          fields: null,
        ) => Promise<void>
      )("csv", null);
    });

    expect(exportAll).toHaveBeenCalledWith("genome", {
      rql: "and(eq(taxon_lineage_ids,561),eq(genome_status,Complete))",
      keyword: "coli",
      fields: genomeCollectionProfile.columns.map((column) => column.id),
      sort: { field: "genome_length", direction: "desc" },
    });
    expect(downloadResourceExport).toHaveBeenCalledWith(
      "genome",
      [row],
      genomeCollectionProfile.columns,
      genomeCollectionProfile.columns.map((column) => column.id),
      "csv",
      "all",
      "genome",
    );
  });

  it("propagates a profile's non-default server keyword mode to exportAll", async () => {
    // Plan item 14: `ResourceChildCollection` builds its profile by spreading a
    // canonical (or supplied) profile, so a `serverKeywordMode` that profile
    // defines has to survive the spread and reach the same `exportAll` call the
    // parent uses — a second, divergent export implementation is exactly what
    // let the child silently drop this field before.
    const data = repository();
    const exportAll = vi.spyOn(data, "exportAll");
    render(
      <ResourceCollection
        profile={{ ...genomeCollectionProfile, serverKeywordMode: "exact" }}
        repository={data}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    await act(async () => {
      await (
        dataTableProps.onDownloadAll as (
          format: "csv",
          fields: null,
        ) => Promise<void>
      )("csv", null);
    });

    expect(exportAll).toHaveBeenCalledWith(
      "genome",
      expect.objectContaining({ keywordMode: "exact" }),
    );
  });

  it("defaults to the prefix keyword contract when a profile leaves serverKeywordMode unset", async () => {
    const data = repository();
    const exportAll = vi.spyOn(data, "exportAll");
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={data}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    await act(async () => {
      await (
        dataTableProps.onDownloadAll as (
          format: "csv",
          fields: null,
        ) => Promise<void>
      )("csv", null);
    });

    // `undefined` here is not "forgot to pass a mode" — the Data API repository
    // (src/lib/data-api/repository.ts) treats anything other than "exact" as a
    // prefix search (it appends `*`), so leaving `serverKeywordMode` unset
    // deliberately keeps the default prefix contract.
    expect(exportAll).toHaveBeenCalledWith(
      "genome",
      expect.objectContaining({ keywordMode: undefined }),
    );
  });

  it("names an export after a profile's exportFileName instead of the resource", async () => {
    // The one sanctioned override point (plan item 14): `ResourceChildCollection`
    // sets this to the tab label so a child export keeps its old, label-based
    // filename instead of silently switching to the shared resource id.
    const data = repository();
    render(
      <ResourceCollection
        profile={{
          ...genomeCollectionProfile,
          exportFileName: "related genomes",
        }}
        repository={data}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    await act(async () => {
      await (
        dataTableProps.onDownloadAll as (
          format: "csv",
          fields: null,
        ) => Promise<void>
      )("csv", null);
    });

    expect(downloadResourceExport).toHaveBeenCalledWith(
      "genome",
      [row],
      genomeCollectionProfile.columns,
      genomeCollectionProfile.columns.map((column) => column.id),
      "csv",
      "all",
      "related genomes",
    );
  });

  it("preserves backend order when exporting an unsorted collection", async () => {
    const data = repository();
    const exportAll = vi.spyOn(data, "exportAll");
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={data}
        state={{ keyword: "", filters: {}, page: 1, sort: "unsorted" }}
        onStateChange={vi.fn()}
      />,
    );

    await act(async () => {
      await (
        dataTableProps.onDownloadAll as (
          format: "csv",
          fields: null,
        ) => Promise<void>
      )("csv", null);
    });

    expect(exportAll).toHaveBeenCalledWith(
      "genome",
      expect.objectContaining({ sort: undefined }),
    );
  });

  it("batches selected exports, restores ID order, and waits for every batch", async () => {
    const ids = Array.from(
      { length: maxSelectedRows + 1 },
      (_, index) => `genome-${String(index)}`,
    );
    const selected = vi.fn(
      (_resource: string, request: { ids: string[]; fields: string[] }) =>
        Promise.resolve({
          rows: [...request.ids]
            .reverse()
            .map((genome_id) => ({ genome_id, genome_name: genome_id })),
        }),
    );
    const data = {
      exportAll: vi.fn(),
      selected,
    } as unknown as DataRepository;
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={data}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    await act(async () => {
      await (
        dataTableProps.onDownloadSelected as (
          format: "csv",
          ids: string[],
          fields: string[],
        ) => Promise<void>
      )("csv", ids, ["genome_name"]);
    });

    expect(selected).toHaveBeenCalledTimes(2);
    expect(selected.mock.calls.map((call) => call[1].ids.length)).toEqual([
      maxSelectedRows,
      1,
    ]);
    expect(selected.mock.calls.every((call) => call[1].fields.includes("genome_id"))).toBe(
      true,
    );
    expect(downloadResourceExport).toHaveBeenCalledWith(
      "genome",
      expect.arrayContaining([
        expect.objectContaining({ genome_id: ids[0] }),
        expect.objectContaining({ genome_id: ids.at(-1) }),
      ]),
      genomeCollectionProfile.columns,
      ["genome_name"],
      "csv",
      "all",
      "genome",
    );
    const exportedRows = downloadResourceExport.mock.calls.at(-1)?.[1] as {
      genome_id: string;
    }[];
    expect(exportedRows.map((exported) => exported.genome_id)).toEqual(ids);
  });

  it("exports selected displayed columns without requiring the ID in the output", async () => {
    const data = repository();
    const selected = vi.spyOn(data, "selected");
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={data}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    await act(async () => {
      await (
        dataTableProps.onDownloadSelected as (
          format: "csv",
          ids: string[],
          fields: string[],
        ) => Promise<void>
      )("csv", ["83332.12"], ["genome_name"]);
    });

    expect(selected).toHaveBeenCalledWith("genome", {
      ids: ["83332.12"],
      fields: ["genome_name", "genome_id"],
    });
    expect(downloadResourceExport).toHaveBeenCalledWith(
      "genome",
      [row],
      genomeCollectionProfile.columns,
      ["genome_name"],
      "csv",
      "all",
      "genome",
    );
  });

  it("does not export all using a previous query's total", async () => {
    const data = repository();
    const exportAll = vi.spyOn(data, "exportAll");
    useResourceCollection.mockReturnValueOnce({
      ...collectionResult(),
      isPlaceholderData: true,
    });
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={data}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    await act(async () => {
      await (
        dataTableProps.onDownloadAll as (
          format: "csv",
          fields: null,
        ) => Promise<void>
      )("csv", null);
    });

    expect(exportAll).not.toHaveBeenCalled();
    expect(screen.getByText(/finish loading before exporting/)).toBeVisible();
  });

  it("exports all during a background refresh of the same query", async () => {
    const data = repository();
    const exportAll = vi.spyOn(data, "exportAll");
    useResourceCollection.mockReturnValueOnce({
      ...collectionResult(),
      isRefreshing: true,
      isPlaceholderData: false,
    });
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={data}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    await act(async () => {
      await (
        dataTableProps.onDownloadAll as (
          format: "csv",
          fields: null,
        ) => Promise<void>
      )("csv", null);
    });

    expect(exportAll).toHaveBeenCalled();
    expect(screen.queryByText(/finish loading/)).not.toBeInTheDocument();
  });

  it("rejects all-matching exports over 10,000 rows before requesting data", async () => {
    const data = repository();
    const exportAll = vi.spyOn(data, "exportAll");
    useResourceCollection.mockReturnValueOnce({
      ...collectionResult(),
      total: 10_001,
    });
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={data}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    await act(async () => {
      await (
        dataTableProps.onDownloadAll as (
          format: "csv",
          fields: null,
        ) => Promise<void>
      )("csv", null);
    });

    expect(exportAll).not.toHaveBeenCalled();
    expect(screen.getByText(/This export matches 10,001 rows/)).toBeVisible();
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
        "and(eq(genome_status,Complete),keyword(existing refinement))",
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
  it("clears hidden selections and exports loaded-keyword matches from every page", async () => {
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

    await act(async () => {
      await (
        dataTableProps.onDownloadAll as (
          format: "csv",
          fields: null,
        ) => Promise<void>
      )("csv", null);
    });

    expect(exportAll).toHaveBeenCalled();
    expect(selected).not.toHaveBeenCalled();
    expect(downloadResourceExport).toHaveBeenCalledWith(
      "genome",
      [
        {
          genome_id: "83332.13",
          genome_name: "DNA gyrase fixture",
          genome_length: 5678,
        },
        laterMatch,
      ],
      genomeCollectionProfile.columns,
      genomeCollectionProfile.columns.map((column) => column.id),
      "csv",
      "all",
      "genome",
    );
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

  it("passes the effective RQL to exportAll, including any explicit state.rql", async () => {
    const data = repository();
    const exportAll = vi.spyOn(data, "exportAll");
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={data}
        state={{ ...state, rql: "eq(genome_id,83332.12)" }}
        onStateChange={vi.fn()}
        baseRql="eq(taxon_lineage_ids,561)"
      />,
    );

    await act(async () => {
      await (
        dataTableProps.onDownloadAll as (
          format: "csv",
          fields: null,
        ) => Promise<void>
      )("csv", null);
    });

    expect(exportAll).toHaveBeenCalledWith(
      "genome",
      expect.objectContaining({
        rql: "and(and(eq(taxon_lineage_ids,561),eq(genome_id,*)),eq(genome_id,83332.12))",
      }),
    );
  });

  it("surfaces the repository's export error message for an all-matching export", async () => {
    const error = new Error("Genome export service unavailable");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const data = repository(Promise.reject(error));
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={data}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    await act(async () => {
      await (
        dataTableProps.onDownloadAll as (
          format: "csv",
          fields: null,
        ) => Promise<void>
      )("csv", null);
    });
    await waitFor(() =>
      expect(
        screen.getByText("Genome export service unavailable"),
      ).toBeVisible(),
    );
    expect(consoleError).toHaveBeenCalledWith("Resource export failed:", error);
    expect(screen.getByText("Could not export genomes")).toBeVisible();
  });

  it("surfaces the repository's export error message for a selected-rows export", async () => {
    const error = new Error("Selected genome export rejected: rate limited");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const data = repository(Promise.reject(error));
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={data}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    await act(async () => {
      await (
        dataTableProps.onDownloadSelected as (
          format: "csv",
          ids: string[],
          fields: string[],
        ) => Promise<void>
      )("csv", ["83332.12"], ["genome_name"]);
    });
    await waitFor(() =>
      expect(
        screen.getByText("Selected genome export rejected: rate limited"),
      ).toBeVisible(),
    );
    expect(consoleError).toHaveBeenCalledWith("Resource export failed:", error);
    expect(screen.getByText("Could not export genomes")).toBeVisible();
  });

  it("falls back to a generic message when an export rejects with a non-Error value", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const exportAll = vi.fn().mockRejectedValueOnce("upstream socket reset");
    const data = {
      exportAll,
      selected: vi.fn(),
    } as unknown as DataRepository;
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={data}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    await act(async () => {
      await (
        dataTableProps.onDownloadAll as (
          format: "csv",
          fields: null,
        ) => Promise<void>
      )("csv", null);
    });
    await waitFor(() =>
      expect(
        screen.getByText(
          "The requested export could not be created. Please try again.",
        ),
      ).toBeVisible(),
    );
    expect(screen.queryByText("upstream socket reset")).not.toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      "Resource export failed:",
      "upstream socket reset",
    );
    expect(screen.getByText("Could not export genomes")).toBeVisible();
  });

  it("falls back to a generic message when an Error's message is empty", async () => {
    // An empty exportError string is falsy, so the `{exportError && (...)}`
    // render guard would suppress the alert entirely if this fell through
    // to formatExportErrorMessage("") instead of the generic fallback.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const data = repository(Promise.reject(new Error()));
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={data}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    await act(async () => {
      await (
        dataTableProps.onDownloadAll as (
          format: "csv",
          fields: null,
        ) => Promise<void>
      )("csv", null);
    });

    await waitFor(() =>
      expect(
        screen.getByText(
          "The requested export could not be created. Please try again.",
        ),
      ).toBeVisible(),
    );
    expect(screen.getByText("Could not export genomes")).toBeVisible();
  });

  it("falls back to a generic message when an Error's message is whitespace-only", async () => {
    // Treated the same as an empty message: whitespace alone is no more
    // actionable to the user than nothing, and would still collapse to a
    // visually-empty (or invisible, depending on the Alert's whitespace
    // handling) alert if surfaced as-is.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const data = repository(Promise.reject(new Error("   ")));
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={data}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    await act(async () => {
      await (
        dataTableProps.onDownloadAll as (
          format: "csv",
          fields: null,
        ) => Promise<void>
      )("csv", null);
    });

    await waitFor(() =>
      expect(
        screen.getByText(
          "The requested export could not be created. Please try again.",
        ),
      ).toBeVisible(),
    );
    expect(screen.getByText("Could not export genomes")).toBeVisible();
  });

  it("truncates an export error message that exceeds the presentation limit", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const longMessage = `Upstream failure: ${"x".repeat(400)}`;
    const data = repository(Promise.reject(new Error(longMessage)));
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={data}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    await act(async () => {
      await (
        dataTableProps.onDownloadAll as (
          format: "csv",
          fields: null,
        ) => Promise<void>
      )("csv", null);
    });

    // Longer than the 300-character presentation limit, so it must be cut
    // down with an ellipsis rather than shown in full or replaced entirely.
    const expectedTruncated = `${longMessage.slice(0, 300)}…`;
    await waitFor(() =>
      expect(screen.getByText(expectedTruncated)).toBeVisible(),
    );
    expect(screen.queryByText(longMessage)).not.toBeInTheDocument();
  });

  it("leaves an export error message under the presentation limit untouched", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    // Under the 300-character limit: must reach the user byte-for-byte, with
    // no truncation ellipsis appended.
    const normalMessage = "Upstream failure: connection reset by peer";
    const data = repository(Promise.reject(new Error(normalMessage)));
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={data}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    await act(async () => {
      await (
        dataTableProps.onDownloadAll as (
          format: "csv",
          fields: null,
        ) => Promise<void>
      )("csv", null);
    });

    await waitFor(() => expect(screen.getByText(normalMessage)).toBeVisible());
  });

  it("does not truncate an export error message exactly at the presentation limit", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    // Exactly 300 characters: the `<=` boundary in formatExportErrorMessage
    // must treat this as "fits" and leave it untouched, with no ellipsis.
    const boundaryMessage = "x".repeat(300);
    expect(boundaryMessage).toHaveLength(300);
    const data = repository(Promise.reject(new Error(boundaryMessage)));
    render(
      <ResourceCollection
        profile={genomeCollectionProfile}
        repository={data}
        state={state}
        onStateChange={vi.fn()}
      />,
    );

    await act(async () => {
      await (
        dataTableProps.onDownloadAll as (
          format: "csv",
          fields: null,
        ) => Promise<void>
      )("csv", null);
    });

    await waitFor(() =>
      expect(screen.getByText(boundaryMessage)).toBeVisible(),
    );
    expect(screen.queryByText(`${boundaryMessage}…`)).not.toBeInTheDocument();
  });
});

// The export sink above already had these two cases; the collection-load and
// action sinks did not, and each rendered its own thing for them — an empty
// `<p>` inside a visible destructive alert, or `String(error)`'s
// "[object Object]". All three now route through one shared formatter, so these
// assert the shared contract at each sink that shows it.
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
