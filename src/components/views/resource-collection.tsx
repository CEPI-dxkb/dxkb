"use client";

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoPanel } from "@/components/detail-panel/info-panel";
import { QueryRetryButton } from "./query-retry-button";
import { ResourceFilterBar } from "./resource-filter-bar";
import { useRetryKeepingError } from "./use-retry-keeping-error";
import { ResourceWorkspace } from "./resource-workspace";
import { useResourceCollectionActions } from "./resource-collection-actions";
import { useResourceCollectionRowResolution } from "./use-resource-collection-row-resolution";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/shared/data-table";
import { useResourceCollection } from "@/hooks/views/use-resource-collection";
import { useTableLayout } from "@/hooks/use-table-layout";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { dataSort, type CollectionState } from "@/lib/views/collection-state";
import { rqlKeyword } from "@/lib/views/rql";
import {
  applyBooleanOverrides,
  applyColumnOrder,
  diffBooleanOverrides,
  resolveFacetVisibility,
  sameOrder,
} from "@/lib/table-layout";
import { formatUserFacingErrorMessage } from "@/lib/utils";
import { resourceCollectionPageSize } from "@/hooks/views/collection-state";
import type { DataRepository, DataResource, DataSort } from "@/lib/data-api";
import {
  resolveCollectionDownloadSpec,
  type CollectionDownloadSpec,
  type DownloadScope,
} from "@/lib/data-api/downloads";

export interface ResourceCollectionFacet {
  field: string;
  label: string;
  initiallyVisible?: boolean;
}

export interface ResourceCollectionProfile<Row extends DataTableRow> {
  resource: DataResource;
  label: string;
  idField: string;
  columns: readonly DataTableColumn[];
  detailFields?: readonly string[];
  guideUrl?: string;
  basePredicate?: string;
  buildStructuralRql?: (state: CollectionState) => string | undefined;
  facets?: readonly ResourceCollectionFacet[];
  rowHref?: (row: Row) => string | undefined;
  rowLinkField?: string;
  rowLinkFields?: readonly string[];
  serverKeywordMode?: "exact" | "prefix";
  /**
   * The order rows are read and exported in while no column is sorted: a
   * legacy grid's default order (`useResourceCollection`'s `unsortedOrder`).
   */
  unsortedOrder?: DataSort;
  /**
   * Overrides the export filename's base segment (otherwise `resource`).
   * `ResourceChildCollection` sets this to the tab's label so a child tab's
   * export stays named after the tab instead of the shared resource id.
   */
  exportFileName?: string;
  /**
   * How this view narrows its resource's download formats
   * (`src/lib/data-api/downloads.ts`). Most profiles declare nothing and get
   * the resource default. A function of the collection state is for a view
   * whose formats follow URL state, such as the Feature list's
   * `filter=protein`.
   */
  download?:
    | CollectionDownloadSpec
    | ((state: CollectionState) => CollectionDownloadSpec);
}

function combinePredicates(...predicates: (string | undefined)[]) {
  const active = predicates.filter((predicate): predicate is string =>
    Boolean(predicate),
  );
  if (active.length === 0) return undefined;
  if (active.length === 1) return active[0];
  return `and(${active.join(",")})`;
}

function matchesLoadedKeyword(row: DataTableRow, keyword: string) {
  return Object.values(row).some((value) => {
    const values = Array.isArray(value) ? value : [value];
    return values.some((item) =>
      String(item ?? "")
        .toLowerCase()
        .includes(keyword),
    );
  });
}

/**
 * Per-sink fallback for `formatUserFacingErrorMessage`, used for a non-`Error`
 * rejection and for an `Error` whose message is empty or whitespace-only. The
 * shared helper owns the emptiness, non-`Error` and length decisions; only the
 * wording that names what failed is decided here. Download and action hooks own
 * the matching fallbacks for their sinks.
 */
const genericCollectionErrorMessage =
  "The requested records could not be loaded. Please try again.";

/** `formatUserFacingErrorMessage` fallback for a failed facet read. */
const genericFacetErrorMessage =
  "The filter values could not be loaded. Please try again.";

export interface ResourceCollectionProps<Row extends DataTableRow> {
  profile: ResourceCollectionProfile<Row>;
  repository: DataRepository;
  state: CollectionState;
  /**
   * `change.clearAll` marks "Clear All Filters", which removes a view's
   * defaults too; any other change that drops the rql (a facet pick) leaves
   * the defaults that rql hid for the caller to restore.
   */
  onStateChange: (
    state: CollectionState,
    change?: { clearAll?: boolean },
  ) => void;
  baseRql?: string;
  /**
   * The state facet counts are read for, when it is not `state`: a view's
   * untouched default filters do not narrow their own facet
   * (`facetCountState`). Rows always use `state`.
   */
  facetState?: CollectionState;
  /**
   * Filters that stay beside an explicit `state.rql` (`filtersBesideRql`), such
   * as the Feature list's PATRIC default: the user can remove or pick their
   * values and keep the rql. Changes to any other filter wait until the rql is
   * cleared, and picking one of their values clears it.
   */
  filtersBesideRql?: readonly string[];
  enableRowLinks?: boolean;
  keywordMode?: "server" | "loaded" | "refine";
  loadedKeywordValue?: string;
  onLoadedKeywordChange?: (value: string) => void;
  keywordPlaceholder?: string;
  /**
   * Fetch the page after the current one in the background so the pager's Next
   * shows it without a round trip. On for every table unless a caller opts out.
   */
  prefetchNextPage?: boolean;
}

export function ResourceCollection<Row extends DataTableRow>({
  profile,
  repository,
  state,
  onStateChange,
  baseRql,
  facetState,
  filtersBesideRql = [],
  enableRowLinks = true,
  keywordMode = "server",
  loadedKeywordValue,
  onLoadedKeywordChange,
  keywordPlaceholder,
  prefetchNextPage = true,
}: ResourceCollectionProps<Row>) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [internalLoadedKeyword, setInternalLoadedKeyword] = useState("");
  const loadedKeyword = loadedKeywordValue ?? internalLoadedKeyword;
  const normalizedLoadedKeyword = loadedKeyword.trim().toLowerCase();
  const hasLoadedKeyword =
    keywordMode === "loaded" && Boolean(normalizedLoadedKeyword);
  const refinementRql =
    keywordMode === "refine" && state.refine
      ? rqlKeyword(state.refine)
      : undefined;
  const [tableLayout, updateTableLayout] = useTableLayout(
    `collection:${profile.resource}`,
  );
  const defaultColumnVisibility = Object.fromEntries(
    profile.columns.map((column) => [column.id, column.visible !== false]),
  );
  const columnVisibility = applyBooleanOverrides(
    defaultColumnVisibility,
    tableLayout.visibility,
  );
  const setColumnVisibility = (next: Record<string, boolean>) => {
    updateTableLayout({
      visibility: diffBooleanOverrides(defaultColumnVisibility, next),
    });
  };
  // No counts are read until the user reaches for the filters (a menu or a
  // pill opens, `onFacetsWanted`); hovering Filters prefetches them. Once
  // wanted, they follow the scope for the rest of the page's life.
  const [facetsWanted, setFacetsWanted] = useState(false);
  // Facets outside the pinned set, counted because the user opened one.
  const [peekedFacetFields, setPeekedFacetFields] = useState<
    ReadonlySet<string>
  >(() => new Set());
  // The saved facet set reads as empty until the render after hydration, and
  // useIsMounted flips in that same render, so counts wait for the set shown.
  const facetsSettled = useIsMounted();
  const { visibility: facetVisibility } = resolveFacetVisibility(
    profile.facets ?? [],
    tableLayout.facets,
  );
  const pinnedFacetFields = (profile.facets ?? [])
    .map((facet) => facet.field)
    .filter((field) => facetVisibility[field]);
  const countedFacetFields = [
    ...pinnedFacetFields,
    ...[...peekedFacetFields].filter(
      (field) => !pinnedFacetFields.includes(field),
    ),
  ];
  const shownFacetFields =
    facetsWanted && facetsSettled ? countedFacetFields : [];
  // Columns in the saved order; the header drags and the Columns menu write it.
  const defaultColumnOrder = profile.columns.map((column) => column.id);
  const orderedColumnIds = applyColumnOrder(
    defaultColumnOrder,
    tableLayout.order,
  );
  const columnById = new Map(
    profile.columns.map((column) => [column.id, column]),
  );
  const structuralRql = combinePredicates(
    baseRql,
    profile.buildStructuralRql?.(state) ?? profile.basePredicate,
    refinementRql,
  );
  const effectiveRql = combinePredicates(structuralRql, state.rql);
  // A field's counts leave its own filter out, so a facet lists every value a
  // pick could add ("any of"), not only the ones already picked. Legacy's
  // counts include it, which makes a second value in one field unpickable.
  const countState = facetState ?? state;
  const facetStructuralRql = (field: string) => {
    const filters = Object.fromEntries(
      Object.entries(countState.filters).filter(([name]) => name !== field),
    );
    return combinePredicates(
      baseRql,
      profile.buildStructuralRql?.({ ...countState, filters }) ??
        profile.basePredicate,
      refinementRql,
    );
  };
  const requestState =
    keywordMode === "loaded" ? { ...state, keyword: undefined } : state;
  const collection = useResourceCollection({
    repository,
    resource: profile.resource,
    idField: profile.idField,
    fields: profile.columns.map((column) => column.id),
    detailFields: profile.detailFields,
    facetFields: shownFacetFields,
    prefetchNextPage,
    structuralRql,
    facetStructuralRql,
    serverKeywordMode: profile.serverKeywordMode,
    unsortedOrder: profile.unsortedOrder,
    state: requestState,
    onStateChange:
      keywordMode === "loaded"
        ? (nextState) => {
            onStateChange({ ...nextState, keyword: state.keyword });
          }
        : onStateChange,
  });
  // A Retry keeps its failure on screen, marked "Retrying…", until it answers,
  // rather than swapping it for skeletons for the whole wait. The rows' Retry
  // also reloads failed counts, whose own error is not shown beside theirs.
  const rowsRetry = useRetryKeepingError(
    {
      error: collection.error,
      isFetching: collection.isInitialLoading || collection.isRefreshing,
      refetch: () => {
        if (collection.facetsError) void collection.refetchFacets();
        return collection.refetch();
      },
    },
    JSON.stringify([
      effectiveRql,
      state.filters,
      requestState.keyword,
      state.page,
      state.sort,
    ]),
  );
  const facetsRetry = useRetryKeepingError(
    {
      error: collection.facetsError,
      isFetching: collection.isFacetsLoading || collection.isFacetsRefreshing,
      refetch: collection.refetchFacets,
    },
    JSON.stringify([
      facetState?.filters,
      effectiveRql,
      (facetState ?? state).filters,
      requestState.keyword,
      shownFacetFields,
    ]),
  );
  const collectionError = rowsRetry.error;
  // A read in flight while the error shows (a Retry, or a background refetch)
  // is a retry of it.
  const rowsRetrying =
    rowsRetry.retrying || (Boolean(collection.error) && collection.isRefreshing);
  // The total on screen is not this query's yet: a previous query's, or none
  // while the first read is in flight. Counts wait instead of reading 0.
  const isTotalPending =
    collection.isPlaceholderData || collection.isInitialLoading;
  const rowLinkFields = new Set(
    profile.rowLinkFields ?? [profile.rowLinkField ?? profile.idField],
  );
  const columns = profile.columns.map((column) =>
    enableRowLinks &&
    rowLinkFields.has(column.id) &&
    profile.rowHref
      ? {
          ...column,
          href: profile.rowHref as (row: DataTableRow) => string | undefined,
        }
      : column,
  );
  const displayedRows = hasLoadedKeyword
    ? collection.rows.filter((row) =>
        matchesLoadedKeyword(row, normalizedLoadedKeyword),
      )
    : collection.rows;
  const displayedTotal = hasLoadedKeyword
    ? displayedRows.length
    : collection.total;
  const displayedIds = hasLoadedKeyword
    ? displayedRows.map((row) => String(row[profile.idField]))
    : undefined;
  const displayedIdSet = new Set(displayedIds);
  const displayedSelectedIds = hasLoadedKeyword
    ? collection.selectedIds.filter((id) => displayedIdSet.has(id))
    : collection.selectedIds;
  const displayedSelection = hasLoadedKeyword
    ? Object.fromEntries(displayedSelectedIds.map((id) => [id, true as const]))
    : collection.selection;
  const detail = collection.detail as Row | null;
  const isDetailDisplayed =
    !hasLoadedKeyword ||
    (collection.activeId !== null && displayedIdSet.has(collection.activeId));
  const displayedDetail = isDetailDisplayed ? detail : null;
  const selectedActionCount = hasLoadedKeyword
    ? displayedSelectedIds.length
    : collection.isAllPagesSelected
      ? collection.total
      : collection.selectedIds.length;

  const sort = dataSort(state.sort) ?? profile.unsortedOrder;
  const {
    rowById: selectedRowById,
    rememberSelectedRows,
    resolveActionRows,
    resolveAllMatchingRows,
  } = useResourceCollectionRowResolution({
    repository,
    resource: profile.resource,
    idField: profile.idField,
    label: profile.label,
    displayedRows: displayedRows as Row[],
    displayedSelectedIds,
    selectedActionCount,
    isAllPagesSelected: collection.isAllPagesSelected,
    hasLoadedKeyword,
    isPlaceholderData: isTotalPending,
    currentTotal: collection.currentTotal,
    rql: effectiveRql,
    keyword: requestState.keyword,
    keywordMode: profile.serverKeywordMode,
    sort,
  });
  // What the Download tile's *All results* covers. A client-side keyword
  // filters the loaded page only, so the rows it leaves are downloaded by id;
  // otherwise it is the query the table sends.
  const allResultsScope: DownloadScope = hasLoadedKeyword
    ? { kind: "selected", ids: displayedIds ?? [] }
    : {
        kind: "query",
        rql: effectiveRql,
        keyword: requestState.keyword,
        keywordMode: profile.serverKeywordMode,
      };
  const downloadSpec = resolveCollectionDownloadSpec(
    profile.resource,
    typeof profile.download === "function"
      ? profile.download(state)
      : profile.download,
  );
  const shownKeyword = state.keyword
    ? state.keyword
    : keywordMode === "refine"
      ? state.refine
      : undefined;
  const downloadQueryLabel = hasLoadedKeyword
    ? `keyword: ${loadedKeyword.trim()}`
    : shownKeyword
      ? `keyword: ${shownKeyword}`
      : state.rql
        ? "custom query"
        : undefined;

  /**
   * Everything resource-specific about the action bar. A hook rather than a
   * component so its state lives in this instance: a collection error drops the
   * action rail, action bar included, and puts the alert below in the table's place,
   * and `actionDialogs` is rendered at section level as a sibling of the workspace,
   * so an in-flight launch survives that. (Crossing the `md` breakpoint does not
   * remount the slot — the workspace renders one stable subtree at every width.)
   */
  const { actionBar, actionDialogs } = useResourceCollectionActions({
    profile,
    selection: {
      count: selectedActionCount,
      ids: collection.selectedIds,
      displayedIds: displayedSelectedIds,
      isAllPagesSelected: collection.isAllPagesSelected,
      total: collection.total,
      isPlaceholderData: isTotalPending,
      currentTotal: collection.currentTotal,
      rowById: selectedRowById,
    },
    detail: displayedDetail,
    activeId: isDetailDisplayed ? collection.activeId : null,
    columnVisibility,
    resolveActionRows,
    resolveAllMatchingRows,
    download: {
      spec: downloadSpec,
      allResults: { scope: allResultsScope, total: displayedTotal },
      sort,
      visibleColumnIds: profile.columns
        .filter((column) => columnVisibility[column.id])
        .map((column) => column.id),
      fileNameBase: profile.exportFileName ?? profile.resource,
      queryLabel: downloadQueryLabel,
    },
    onError: setActionError,
  });

  const detailContent = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto bg-background text-foreground shadow-md">
        {collection.detailError ? (
          <Alert variant="destructive" className="m-4">
            <AlertTitle>Could not load record details</AlertTitle>
            <AlertDescription>
              {collection.detailError instanceof Error
                ? collection.detailError.message
                : String(collection.detailError)}
            </AlertDescription>
          </Alert>
        ) : (
          <InfoPanel
            variant="search"
            activeTab={profile.resource}
            selectedIds={displayedSelectedIds}
            selectedRow={displayedDetail}
            isLoading={collection.isDetailLoading && isDetailDisplayed}
            isAllPagesSelected={
              hasLoadedKeyword ? false : collection.isAllPagesSelected
            }
            totalItems={displayedTotal}
          />
        )}
      </div>
    </div>
  );

  // One row above the table, inside its column (the action rail sits beside
  // it): keyword, Filters, active filter pills, Clear all and Columns.
  const toolbar = (
    <ResourceFilterBar
      layoutKey={`collection:${profile.resource}`}
      keyword={
        keywordMode === "server"
          ? state.keyword
          : keywordMode === "refine"
            ? state.refine
            : loadedKeyword
      }
      filters={state.filters}
      facets={collection.facets}
      facetStatuses={collection.facetStatuses}
      // One failure, one alert: while the rows have failed, the panel does
      // not repeat it (VWA-7: `/strain` showed two red errors).
      facetsError={
        facetsRetry.error && !collectionError
          ? formatUserFacingErrorMessage(
              facetsRetry.error,
              genericFacetErrorMessage,
            )
          : undefined
      }
      facetsUnavailable={Boolean(facetsRetry.error && collectionError)}
      facetsRetrying={facetsRetry.retrying}
      onRetryFacets={facetsRetry.retry}
      peekedFields={peekedFacetFields}
      onPeekedFieldsChange={setPeekedFacetFields}
      onFacetsWanted={() => {
        setFacetsWanted(true);
      }}
      onPrefetchFacets={() => {
        if (facetsSettled) collection.prefetchFacets(countedFacetFields);
      }}
      columns={orderedColumnIds.map((id) => ({
        id,
        label: columnById.get(id)?.label ?? id,
        visible: columnVisibility[id] ?? false,
        defaultVisible: defaultColumnVisibility[id] ?? false,
        defaultIndex: defaultColumnOrder.indexOf(id),
      }))}
      setColumns={({ visibility, order }) => {
        updateTableLayout({
          ...(visibility && {
            visibility: diffBooleanOverrides(defaultColumnVisibility, {
              ...columnVisibility,
              ...visibility,
            }),
          }),
          ...(order && {
            order: sameOrder(order, defaultColumnOrder) ? undefined : order,
          }),
        });
      }}
      resetColumns={() => {
        updateTableLayout({ visibility: undefined, order: undefined });
      }}
      definitions={profile.facets ?? []}
      hasExplicitRql={Boolean(state.rql)}
      filtersBesideRql={filtersBesideRql}
      keywordPlaceholder={keywordPlaceholder}
      onChange={({ keyword, filters, clearRql, clearAll }) => {
        if (keywordMode === "loaded") {
          const nextLoadedKeyword = keyword ?? "";
          if (nextLoadedKeyword !== loadedKeyword) {
            collection.setSelection({});
            collection.setIsAllPagesSelected(false);
          }
          setInternalLoadedKeyword(nextLoadedKeyword);
          onLoadedKeywordChange?.(nextLoadedKeyword);
          if (filters === state.filters && !clearRql) return;
        }
        const next = {
          ...state,
          keyword: keywordMode === "server" ? keyword : state.keyword,
          refine: keywordMode === "refine" ? keyword : state.refine,
          filters:
            state.rql && !clearRql
              ? Object.fromEntries([
                  ...Object.entries(state.filters).filter(
                    ([name]) => !filtersBesideRql.includes(name),
                  ),
                  ...Object.entries(filters).filter(([name]) =>
                    filtersBesideRql.includes(name),
                  ),
                ])
              : filters,
          rql: clearRql ? undefined : state.rql,
          page: 1,
        };
        if (clearAll) onStateChange(next, { clearAll });
        else onStateChange(next);
      }}
    />
  );

  return (
    <section
      aria-label={profile.label}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      {/* Never a count the query has not answered: the first read's wait is
          "Loading results…", and a failure is announced by its own
          role="alert" below, so this says nothing then but a retry. */}
      <span className="sr-only" aria-live="polite">
        {collectionError
          ? rowsRetrying
            ? "Retrying…"
            : ""
          : collection.isInitialLoading
            ? "Loading results…"
            : collection.isRefreshing
              ? "Refreshing results..."
              : `${String(displayedTotal)} results`}
      </span>

      {actionError && (
        <Alert variant="destructive">
          <AlertTitle>Could not complete action</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {/* One workspace whether or not the rows failed, so the toolbar (keyword
          draft and focus, a pending pick, an open Filters menu) is never
          remounted by a failure or by the Retry that ends it. A failure drops
          the action rail and the detail panel; the alert takes the table's
          place. */}
      <ResourceWorkspace
        toolbar={toolbar}
        hasActionRail={!collectionError}
        hasSidePanel={
          !collectionError &&
          (hasLoadedKeyword
            ? displayedSelectedIds.length > 0
            : collection.isAllPagesSelected ||
              collection.selectedIds.length > 0)
        }
        actionBar={actionBar}
        sidePanel={detailContent}
      >
        {collectionError ? (
          <Alert variant="destructive" aria-busy={rowsRetrying || undefined}>
            <AlertTitle>
              Could not load {profile.label.toLowerCase()}
            </AlertTitle>
            <AlertDescription>
              <p>
                {formatUserFacingErrorMessage(
                  collectionError,
                  genericCollectionErrorMessage,
                )}
              </p>
              <QueryRetryButton
                retrying={rowsRetrying}
                onRetry={rowsRetry.retry}
              />
            </AlertDescription>
          </Alert>
        ) : (
          <DataTable
            id={`${profile.resource}-collection`}
            resource={profile.resource}
            idField={profile.idField}
            data={displayedRows}
            columns={columns}
            totalItems={displayedTotal}
            pageIndex={hasLoadedKeyword ? 0 : state.page - 1}
            pageSize={resourceCollectionPageSize}
            sorting={collection.sorting}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
            savedColumnWidths={tableLayout.widths}
            onColumnWidthsCommit={(widths) => {
              updateTableLayout({
                widths: { ...tableLayout.widths, ...widths },
              });
            }}
            rowSelection={displayedSelection}
            selectedIds={displayedSelectedIds}
            isAllPagesSelected={
              hasLoadedKeyword ? false : collection.isAllPagesSelected
            }
            onAllPagesSelectionChange={(selected) => {
              collection.setIsAllPagesSelected(selected);
              if (selected) collection.setSelection({});
            }}
            totalSelectedCount={
              hasLoadedKeyword
                ? displayedSelectedIds.length
                : collection.isAllPagesSelected
                  ? collection.total
                  : collection.selectedIds.length
            }
            onPageChange={collection.setPageIndex}
            onSortingChange={collection.setSorting}
            onRowSelectionChange={(selection) => {
              collection.setSelection(selection);
              rememberSelectedRows(selection);
            }}
            // Downloads live in the action rail's Download tile.
            showExportControls={false}
            // The toolbar's Columns menu replaces the table's own.
            hideColumnControls
            // The selection column stays first; a header drag reorders the rest.
            columnOrder={["__select__", ...orderedColumnIds]}
            onColumnOrderChange={(order) => {
              const ids = order.filter((id) => id !== "__select__");
              updateTableLayout({
                order: sameOrder(ids, defaultColumnOrder) ? undefined : ids,
              });
            }}
            scrollRegionLabel={`${profile.label} results table`}
            isLoading={collection.isInitialLoading || collection.isPageLoading}
            isRefreshing={collection.isPlaceholderData}
          />
        )}
      </ResourceWorkspace>
      {actionDialogs}
    </section>
  );
}
