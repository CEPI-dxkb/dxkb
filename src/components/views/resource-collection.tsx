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
import { dataSort, type CollectionState } from "@/lib/views/collection-state";
import { rqlKeyword } from "@/lib/views/rql";
import {
  applyBooleanOverrides,
  applyColumnOrder,
  diffBooleanOverrides,
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
  unsortedOrder?: DataSort;
  exportFileName?: string;
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

const genericCollectionErrorMessage =
  "The requested records could not be loaded. Please try again.";

const genericFacetErrorMessage =
  "The filter values could not be loaded. Please try again.";

export interface ResourceCollectionProps<Row extends DataTableRow> {
  profile: ResourceCollectionProfile<Row>;
  repository: DataRepository;
  state: CollectionState;
  /**
   * `change.clearAll` removes a view's defaults too; any other change that
   * drops the rql leaves them for the caller to restore.
   */
  onStateChange: (
    state: CollectionState,
    change?: { clearAll?: boolean },
  ) => void;
  baseRql?: string;
  facetState?: CollectionState;
  filtersBesideRql?: readonly string[];
  enableRowLinks?: boolean;
  keywordMode?: "server" | "loaded" | "refine";
  loadedKeywordValue?: string;
  onLoadedKeywordChange?: (value: string) => void;
  keywordPlaceholder?: string;
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
  const [facetsWanted, setFacetsWanted] = useState(false);
  // Every facet the profile defines is counted, in one read, once the user
  // reaches for the filters.
  const facetFieldList = (profile.facets ?? []).map((facet) => facet.field);
  const shownFacetFields = facetsWanted ? facetFieldList : [];
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
  // A field's counts leave its own filter out so a facet lists every value a
  // pick could add; legacy includes it, which makes a second value unpickable.
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
  const rowsRetrying =
    rowsRetry.retrying || (Boolean(collection.error) && collection.isRefreshing);
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
      onFacetsWanted={() => {
        setFacetsWanted(true);
      }}
      onPrefetchFacets={() => {
        collection.prefetchFacets(facetFieldList);
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

      {/* One workspace whether or not the rows failed, so the toolbar is
         never remounted by a failure or its Retry. */}
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
              updateTableLayout((current) => ({
                widths: { ...current.widths, ...widths },
              }));
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
            showExportControls={false}
            hideColumnControls
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
