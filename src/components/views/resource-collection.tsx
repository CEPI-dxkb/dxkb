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
import { dataSort, type CollectionState } from "@/lib/views/collection-state";
import { rqlKeyword } from "@/lib/views/rql";
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

export interface ResourceCollectionProps<Row extends DataTableRow> {
  profile: ResourceCollectionProfile<Row>;
  repository: DataRepository;
  state: CollectionState;
  onStateChange: (state: CollectionState) => void;
  baseRql?: string;
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
  enableRowLinks = true,
  keywordMode = "server",
  loadedKeywordValue,
  onLoadedKeywordChange,
  keywordPlaceholder,
  prefetchNextPage = false,
}: ResourceCollectionProps<Row>) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [internalLoadedKeyword, setInternalLoadedKeyword] = useState("");
  const loadedKeyword = loadedKeywordValue ?? internalLoadedKeyword;
  const normalizedLoadedKeyword = loadedKeyword.trim().toLowerCase();
  const hasLoadedKeyword =
    keywordMode === "loaded" && Boolean(normalizedLoadedKeyword);
  const refinementRql =
    keywordMode === "refine" && state.refine?.trim()
      ? rqlKeyword(state.refine.trim())
      : undefined;
  const [columnVisibility, setColumnVisibility] = useState(() =>
    Object.fromEntries(
      profile.columns.map((column) => [column.id, column.visible !== false]),
    ),
  );
  const structuralRql = combinePredicates(
    baseRql,
    profile.buildStructuralRql?.(state) ?? profile.basePredicate,
    refinementRql,
  );
  const effectiveRql = combinePredicates(structuralRql, state.rql);
  const requestState =
    keywordMode === "loaded" ? { ...state, keyword: undefined } : state;
  const collection = useResourceCollection({
    repository,
    resource: profile.resource,
    idField: profile.idField,
    fields: profile.columns.map((column) => column.id),
    detailFields: profile.detailFields,
    facetFields: profile.facets?.map((facet) => facet.field),
    prefetchNextPage,
    structuralRql,
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
    isRefreshing: collection.isRefreshing,
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
    isRefreshing: collection.isRefreshing,
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
      <div className="bg-background text-foreground min-h-0 flex-1 overflow-y-auto shadow-md">
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
        keyword={
          keywordMode === "server"
            ? state.keyword
            : keywordMode === "refine"
              ? state.refine
              : loadedKeyword
        }
        filters={state.filters}
        facets={collection.facets}
        definitions={profile.facets ?? []}
        hasExplicitRql={Boolean(state.rql)}
        keywordPlaceholder={keywordPlaceholder}
        onChange={({ keyword, filters, clearRql }) => {
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
          onStateChange({
            ...state,
            keyword: keywordMode === "server" ? keyword : state.keyword,
            refine: keywordMode === "refine" ? keyword : state.refine,
            filters: state.rql && !clearRql ? state.filters : filters,
            rql: clearRql ? undefined : state.rql,
            page: 1,
          });
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
            isLoading={collection.isInitialLoading}
          />
        </ResourceWorkspace>
      )}
      {actionDialogs}
    </section>
  );
}
