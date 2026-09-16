"use client";

import { useState, type ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InfoPanel } from "@/components/detail-panel/info-panel";
import { ResourceFilterBar } from "./resource-filter-bar";
import { downloadResourceExport } from "./resource-export";
import { ResourceWorkspace } from "./resource-workspace";
import { useResourceCollectionActions } from "./resource-collection-actions";
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
import {
  maxExportRows,
  type DataRepository,
  type DataResource,
} from "@/lib/data-api";

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
 * Per-sink fallbacks for `formatUserFacingErrorMessage`, used for a non-`Error`
 * rejection and for an `Error` whose message is empty or whitespace-only. The
 * shared helper owns the emptiness, non-`Error` and length decisions; only the
 * wording — which names what actually failed — is decided here.
 *
 * An empty string would be falsy and suppress the `{exportError && (...)}` /
 * `{collection.error && (...)}` render guards entirely, so neither may be blank.
 * `useResourceCollectionActions` owns the matching fallback for its own sink.
 */
const genericExportErrorMessage =
  "The requested export could not be created. Please try again.";
const genericCollectionErrorMessage =
  "The requested records could not be loaded. Please try again.";

/**
 * Loaded-mode keyword matching: a case-insensitive substring test over every scalar
 * or array-valued field of a row. `keyword` must already be trimmed and lower-cased.
 *
 * Module-private: this file now owns the only export implementation, so the table
 * rows and the exported rows are filtered by the same call. (It used to be exported
 * for `ResourceChildCollection`'s own exporter, which plan item 19 deleted.)
 */
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

export interface ResourceCollectionProps<Row extends DataTableRow> {
  profile: ResourceCollectionProfile<Row>;
  repository: DataRepository;
  state: CollectionState;
  onStateChange: (state: CollectionState) => void;
  baseRql?: string;
  enableRowLinks?: boolean;
  renderDetail?: (row: Row) => ReactNode;
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
  renderDetail,
  keywordMode = "server",
  loadedKeywordValue,
  onLoadedKeywordChange,
  keywordPlaceholder,
  prefetchNextPage = false,
}: ResourceCollectionProps<Row>) {
  const [exportError, setExportError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedRowsById, setSelectedRowsById] = useState<
    Partial<Record<string, Row>>
  >({});
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
  const columns = profile.columns.map((column) =>
    enableRowLinks &&
    (
      profile.rowLinkFields ?? [profile.rowLinkField ?? profile.idField]
    ).includes(column.id) &&
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

  /**
   * The row behind a selected ID. `selectedRowsById` remembers rows the table has
   * since paged away from, so an action that needs a column of the selection still
   * sees every picked row.
   */
  const selectedRowById = (id: string) =>
    selectedRowsById[id] ??
    (displayedRows.find((row) => String(row[profile.idField]) === id) as
      | Row
      | undefined);

  /**
   * Every row matching the current query, with the supplied fields. Scope, keyword
   * and sort are the shell's, so an action that has to resolve a column the table
   * does not hold asks for the column instead of rebuilding the query.
   */
  const resolveAllMatchingRows = async (fields: readonly string[]) => {
    const result = await repository.exportAll(profile.resource, {
      rql: effectiveRql,
      keyword: requestState.keyword,
      keywordMode: profile.serverKeywordMode,
      fields: [...fields],
      sort: dataSort(state.sort),
    });
    return result.rows;
  };

  const resolveActionRows = async (
    fields: readonly string[],
    maxRows: number,
    actionLabel: string,
  ): Promise<Record<string, unknown>[]> => {
    if (selectedActionCount > maxRows) {
      throw new Error(
        `${actionLabel} supports at most ${maxRows.toLocaleString()} ${profile.label}. Narrow the selection and try again.`,
      );
    }

    const selectedFields = [...fields];
    if (!collection.isAllPagesSelected || hasLoadedKeyword) {
      const ids = [...displayedSelectedIds];
      const rows: Record<string, unknown>[] = [];
      for (let offset = 0; offset < ids.length; offset += 500) {
        const result = await repository.selected(profile.resource, {
          ids: ids.slice(offset, offset + 500),
          fields: selectedFields,
        });
        rows.push(...result.rows);
      }
      return rows;
    }

    if (collection.isRefreshing) {
      throw new Error(
        "Wait for the current results to finish loading and try again.",
      );
    }
    return resolveAllMatchingRows(selectedFields);
  };

  const exportRows = async (
    format: "csv" | "txt",
    selectedIds?: readonly string[],
    fields: readonly string[] | null = null,
    isAllPagesSelected = false,
  ) => {
    setExportError(null);
    const ids = isAllPagesSelected ? undefined : selectedIds;
    if (ids && ids.length === 0) return;
    if (!ids && collection.isRefreshing) {
      setExportError(
        "Wait for the current results to finish loading before exporting.",
      );
      return;
    }
    if (!ids?.length && collection.total > maxExportRows) {
      setExportError(
        `This export matches ${collection.total.toLocaleString()} rows. Narrow the results to ${maxExportRows.toLocaleString()} rows or fewer and try again.`,
      );
      return;
    }
    try {
      const selectedFields = fields
        ? [...fields]
        : profile.columns.map((column) => column.id);
      const allFields = profile.columns.map((column) => column.id);
      const result = ids?.length
        ? await repository.selected(profile.resource, {
            ids: [...ids],
            fields: selectedFields,
          })
        : await repository.exportAll(profile.resource, {
            rql: effectiveRql,
            keyword: requestState.keyword,
            keywordMode: profile.serverKeywordMode,
            fields: hasLoadedKeyword ? allFields : selectedFields,
            sort: dataSort(state.sort),
          });
      const exportedRows =
        hasLoadedKeyword && !ids
          ? result.rows.filter((row) =>
              matchesLoadedKeyword(row, normalizedLoadedKeyword),
            )
          : result.rows;
      downloadResourceExport(
        profile.resource,
        exportedRows,
        profile.columns,
        selectedFields,
        format,
        "all",
        profile.exportFileName ?? profile.resource,
      );
    } catch (error) {
      console.error("Resource export failed:", error);
      setExportError(
        formatUserFacingErrorMessage(error, genericExportErrorMessage),
      );
    }
  };

  /**
   * Everything resource-specific about the action bar. A hook rather than a
   * component so its state lives in this instance: `ResourceWorkspace` remounts its
   * `actionBar` slot when the `md` breakpoint flips, and `actionDialogs` is rendered
   * below at section level, outside the workspace, so an in-flight launch survives
   * both.
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
        ) : renderDetail && displayedDetail ? (
          renderDetail(displayedDetail)
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
              setSelectedRowsById((current) => {
                const next: Record<string, Row> = {};
                for (const id of Object.keys(selection)) {
                  const selectedRow =
                    (displayedRows.find(
                      (row) => String(row[profile.idField]) === id,
                    ) as Row | undefined) ?? current[id];
                  if (selectedRow) next[id] = selectedRow;
                }
                return next;
              });
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
