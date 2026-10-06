"use client";

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InfoPanel } from "@/components/detail-panel/info-panel";
import { ResourceFilterBar } from "./resource-filter-bar";
import { ResourceWorkspace } from "./resource-workspace";
import { useResourceCollectionActions } from "./resource-collection-actions";
import {
  matchesLoadedKeyword,
  useResourceCollectionExport,
} from "./use-resource-collection-export";
import { useResourceCollectionRowResolution } from "./use-resource-collection-row-resolution";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRow,
} from "@/components/shared/data-table";
import { useResourceCollection } from "@/hooks/views/use-resource-collection";
import { useTableLayout } from "@/hooks/use-table-layout";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { useUiPreference } from "@/lib/ui-preferences/provider";
import { dataSort, type CollectionState } from "@/lib/views/collection-state";
import { rqlKeyword } from "@/lib/views/rql";
import {
  applyBooleanOverrides,
  diffBooleanOverrides,
  resolveFacetVisibility,
} from "@/lib/table-layout";
import { formatUserFacingErrorMessage } from "@/lib/utils";
import { resourceCollectionPageSize } from "@/hooks/views/collection-state";
import type { DataRepository, DataResource } from "@/lib/data-api";

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
   * Overrides the export filename's base segment (otherwise `resource`).
   * `ResourceChildCollection` sets this to the tab's label so a child tab's
   * export stays named after the tab instead of the shared resource id.
   */
  exportFileName?: string;
}

function combinePredicates(...predicates: (string | undefined)[]) {
  const active = predicates.filter((predicate): predicate is string =>
    Boolean(predicate),
  );
  if (active.length === 0) return undefined;
  if (active.length === 1) return active[0];
  return `and(${active.join(",")})`;
}

/**
 * Per-sink fallback for `formatUserFacingErrorMessage`, used for a non-`Error`
 * rejection and for an `Error` whose message is empty or whitespace-only. The
 * shared helper owns the emptiness, non-`Error` and length decisions; only the
 * wording that names what failed is decided here. Export and action hooks own
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
  const [facetPanelOpen] = useUiPreference("facetPanelOpen");
  // The saved facet set reads as empty until the render after hydration, and
  // useIsMounted flips in that same render, so counts wait for the set shown.
  const facetsSettled = useIsMounted();
  const { visibility: facetVisibility } = resolveFacetVisibility(
    profile.facets ?? [],
    tableLayout.facets,
  );
  // Counts are requested for exactly the columns `ResourceFilterBar` shows: none
  // while its panel is closed (the default), and never a collapsed facet. Both
  // read `facetPanelOpen` from the one provider the root layout mounts.
  const shownFacetFields =
    facetPanelOpen && facetsSettled
      ? (profile.facets ?? [])
          .map((facet) => facet.field)
          .filter((field) => facetVisibility[field])
      : [];
  const structuralRql = combinePredicates(
    baseRql,
    profile.buildStructuralRql?.(state) ?? profile.basePredicate,
    refinementRql,
  );
  const effectiveRql = combinePredicates(structuralRql, state.rql);
  const facetScope = facetState
    ? {
        structuralRql: combinePredicates(
          baseRql,
          profile.buildStructuralRql?.(facetState) ?? profile.basePredicate,
          refinementRql,
        ),
      }
    : undefined;
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
    facetScope,
    serverKeywordMode: profile.serverKeywordMode,
    state: requestState,
    onStateChange:
      keywordMode === "loaded"
        ? (nextState) => {
            onStateChange({ ...nextState, keyword: state.keyword });
          }
        : onStateChange,
  });
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

  const sort = dataSort(state.sort);
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
    isPlaceholderData: collection.isPlaceholderData,
    rql: effectiveRql,
    keyword: requestState.keyword,
    keywordMode: profile.serverKeywordMode,
    sort,
  });
  const { exportError, exportRows } = useResourceCollectionExport({
    repository,
    resource: profile.resource,
    idField: profile.idField,
    columns: profile.columns,
    exportFileName: profile.exportFileName,
    total: collection.total,
    isPlaceholderData: collection.isPlaceholderData,
    hasLoadedKeyword,
    loadedKeyword: normalizedLoadedKeyword,
    rql: effectiveRql,
    keyword: requestState.keyword,
    keywordMode: profile.serverKeywordMode,
    sort,
  });

  /**
   * Everything resource-specific about the action bar. A hook rather than a
   * component so its state lives in this instance: a collection error replaces the
   * whole workspace, action bar included, with the alert below, and `actionDialogs` is
   * rendered at section level as a sibling of the workspace, so an in-flight launch
   * survives that. (Crossing the `md` breakpoint does not remount the slot — the
   * workspace renders one stable subtree at every width.)
   */
  const { actionBar, actionDialogs } = useResourceCollectionActions({
    profile,
    selection: {
      count: selectedActionCount,
      ids: collection.selectedIds,
      displayedIds: displayedSelectedIds,
      isAllPagesSelected: collection.isAllPagesSelected,
      total: collection.total,
      isPlaceholderData: collection.isPlaceholderData,
      rowById: selectedRowById,
    },
    detail: displayedDetail,
    activeId: isDetailDisplayed ? collection.activeId : null,
    columnVisibility,
    resolveActionRows,
    resolveAllMatchingRows,
    onExportSelection: () => {
      void exportRows(
        "csv",
        displayedSelectedIds,
        null,
        collection.isAllPagesSelected,
      );
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

  return (
    <section
      aria-label={profile.label}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
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
        // Until the saved facet set settles no counts are requested at all, so
        // an open panel shows placeholders rather than "No values".
        facetsLoading={!facetsSettled || collection.isFacetsLoading}
        facetsRefreshing={collection.isFacetsRefreshing}
        facetsError={
          collection.facetsError
            ? formatUserFacingErrorMessage(
                collection.facetsError,
                genericFacetErrorMessage,
              )
            : undefined
        }
        onRetryFacets={() => {
          void collection.refetchFacets();
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
      <span className="sr-only" aria-live="polite">
        {collection.isRefreshing
          ? "Refreshing results..."
          : `${String(displayedTotal)} results`}
      </span>

      {exportError && (
        <Alert variant="destructive">
          <AlertTitle>
            Could not export {profile.label.toLowerCase()}
          </AlertTitle>
          <AlertDescription>{exportError}</AlertDescription>
        </Alert>
      )}
      {actionError && (
        <Alert variant="destructive">
          <AlertTitle>Could not complete action</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {collection.error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load {profile.label.toLowerCase()}</AlertTitle>
          <AlertDescription>
            <p>
              {formatUserFacingErrorMessage(
                collection.error,
                genericCollectionErrorMessage,
              )}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void collection.refetch();
              }}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <ResourceWorkspace
          hasSidePanel={
            hasLoadedKeyword
              ? displayedSelectedIds.length > 0
              : collection.isAllPagesSelected ||
                collection.selectedIds.length > 0
          }
          actionBar={actionBar}
          sidePanel={detailContent}
        >
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
            onDownloadAll={(format, fields) =>
              exportRows(format, undefined, fields)
            }
            onDownloadSelected={(format, ids, fields) =>
              exportRows(format, ids, fields)
            }
            scrollRegionLabel={`${profile.label} results table`}
            isLoading={collection.isInitialLoading || collection.isPageLoading}
          />
        </ResourceWorkspace>
      )}
      {actionDialogs}
    </section>
  );
}
