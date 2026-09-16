"use client";

import { useDeferredValue, useEffect, useEffectEvent, useState } from "react";
import { DataTable } from "@/components/shared/data-table";
import type { RowSelectionState, SortingState } from "@tanstack/react-table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUserFacingErrorMessage, noop } from "@/lib/utils";
import { getIdField } from "@/constants/resources";
import { detailPanelQueryKey } from "@/components/genome/genome-detail-panel-utils";
import { FilterBar } from "@/components/filterbar/filter-bar";
import { combineRql } from "@/components/filterbar/filter-utils";
import {
  DataRepository,
  collectionQueryOptions,
  maxExportRows,
} from "@/lib/data-api";
import type { CollectionRequest, DataResource, DataSort } from "@/lib/data-api";
import { downloadResourceExport } from "@/components/views/resource-export";
import {
  deriveTableFields,
  downloadLoadedResourceRows,
  findPageRow,
  isSameResourceQuery,
  projectedFields,
} from "./list-data-utils";

// The sanctioned browser-side Data API entrypoint (`/api/data/<resource>`) for
// every read this list makes. Stateless wrapper around fetch, so a single
// module-level instance is the established pattern (see e.g.
// genome-resource-collection.tsx, use-interactions.ts).
const dataRepository = new DataRepository();

// Stable empty-rows reference so DataTable's memoized body comparator (prev.data === next.data)
// isn't defeated by a fresh [] on every render when there are no results.
const emptyRows: Record<string, unknown>[] = [];

// One page is also the gateway's per-request ceiling (`pageSize` in
// src/lib/data-api/validation.ts), so a larger value here would be rejected.
const pageSize = 200;

const staleTimeMs = 5 * 60 * 1000;

interface ListDataProps {
  q: string;
  resource: DataResource;
  onSelectionChange?: (ids: string[]) => void;
  onSelectedRowChange?: (row: Record<string, unknown> | null) => void;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  pageIndex?: number;
  onPageChange?: (page: number) => void;
  selectedIds?: string[];
  isAllPagesSelected?: boolean;
  onAllPagesSelectionChange?: (selected: boolean) => void;
  onTotalItemsChange?: (total: number) => void;
  filter?: string;
  onFilterChange?: (rql: string) => void;
  keywordValue?: string;
  onKeywordChange?: (value: string) => void;
  keywordMode?: "server" | "loaded";
}

function useListData({
  q,
  resource,
  onSelectionChange,
  onSelectedRowChange,
  rowSelection: controlledRowSelection,
  onRowSelectionChange,
  pageIndex: controlledPageIndex,
  onPageChange,
  selectedIds,
  isAllPagesSelected: controlledIsAllPagesSelected,
  onAllPagesSelectionChange,
  onTotalItemsChange,
  filter: controlledFilter,
  onFilterChange,
  keywordValue,
  onKeywordChange,
  keywordMode = "server",
}: ListDataProps) {
  const fields = deriveTableFields(resource);
  const queryClient = useQueryClient();
  const idField = getIdField(resource);

  // Use controlled rowSelection if provided, otherwise use internal state
  const [internalRowSelection, setInternalRowSelection] =
    useState<RowSelectionState>({});
  const rowSelection =
    controlledRowSelection !== undefined
      ? controlledRowSelection
      : internalRowSelection;
  const setRowSelection = onRowSelectionChange || setInternalRowSelection;
  // `filter` is controlled only when the parent passes it. `onFilterChange`
  // alone is notify-only: ListData applies its filter locally and reports it.
  const [internalFilter, setInternalFilter] = useState("");
  const [loadedKeyword, setLoadedKeyword] = useState("");
  const deferredLoadedKeyword = useDeferredValue(loadedKeyword.trim().toLowerCase());
  const filter =
    controlledFilter !== undefined ? controlledFilter : internalFilter;
  const setFilter = (rql: string) => {
    if (controlledFilter === undefined) setInternalFilter(rql);
    onFilterChange?.(rql);
  };
  const [internalIsAllPagesSelected, setInternalIsAllPagesSelected] =
    useState(false);
  const isAllPagesSelected =
    controlledIsAllPagesSelected !== undefined
      ? controlledIsAllPagesSelected
      : internalIsAllPagesSelected;
  const setIsAllPagesSelected =
    onAllPagesSelectionChange || setInternalIsAllPagesSelected;

  const facetFields = fields.filter((f) => f.facet);

  const widget = {
    id: "widget-1",
    columns: fields,
  };

  const cleanQ = q.split("#")[0];

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    fields.length ? ["__select__", ...fields.map((f) => f.id)] : [],
  );
  const [internalPageIndex, setInternalPageIndex] = useState(0);
  const pageIndex =
    controlledPageIndex !== undefined ? controlledPageIndex : internalPageIndex;
  const setPageIndex = onPageChange || setInternalPageIndex;

  const [prevResource, setPrevResource] = useState(resource);
  if (prevResource !== resource) {
    setPrevResource(resource);
    setSorting([]);
  }

  const setSortingAndResetPage = (newSorting: SortingState) => {
    setSorting(newSorting);
    setPageIndex(0);
  };

  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >(() => {
    const vis: Record<string, boolean> = { __select__: true };
    fields.forEach((f) => {
      vis[f.id] = f.visible;
    });
    return vis;
  });

  // Reseed order + visibility if `fields` identity changes (resource swap on the
  // same ListData instance). With synchronous field derivation this does not fire
  // on mount — only on an actual resource change.
  const [prevFields, setPrevFields] = useState(fields);
  if (prevFields !== fields) {
    setPrevFields(fields);
    if (fields.length) {
      setColumnOrder(["__select__", ...fields.map((f) => f.id)]);
      const vis: Record<string, boolean> = { __select__: true };
      fields.forEach((f) => {
        vis[f.id] = f.visible;
      });
      setColumnVisibility(vis);
    }
  }

  // DataTable only offers a sort header for a column the registry declares
  // sortable, which is the same value the gateway's `validateSort` enforces.
  const sort: DataSort | undefined =
    sorting.length > 0
      ? {
          field: sorting[0].id,
          direction: sorting[0].desc ? "desc" : "asc",
        }
      : undefined;
  const sortingKey = sort ? `${sort.field}:${sort.direction}` : "none";

  const combinedQuery = combineRql(cleanQ, filter);
  const projection = projectedFields(resource, idField);

  const collectionRequest: Omit<CollectionRequest, "operation"> = {
    rql: combinedQuery || undefined,
    page: pageIndex + 1,
    pageSize,
    sort,
    fields: projection,
  };

  // One request carries both the page of rows and the matching total, so the
  // separate count read this replaced is gone.
  const {
    data: collection,
    isLoading,
    isPlaceholderData,
    error,
  } = useQuery({
    ...collectionQueryOptions(dataRepository, resource, collectionRequest),
    // Keep the previous page's rows during a refetch for smooth pagination —
    // but ONLY within the same resource. `collectionQueryOptions` defaults to
    // `keepPreviousData`, which on a resource change bleeds the old resource's
    // rows into a table now keyed by the new resource's idField and produces
    // duplicate/undefined React keys. `dataQueryKeys.collection` puts the
    // resource at index 1 of the key, which is what `isSameResourceQuery` reads.
    placeholderData: (previousData, previousQuery) =>
      isSameResourceQuery(previousQuery?.queryKey, resource)
        ? previousData
        : undefined,
    staleTime: staleTimeMs,
  });

  const totalItems = collection?.total ?? 0;

  const notifyTotalItems = (node: HTMLSpanElement | null) => {
    if (node) onTotalItemsChange?.(totalItems);
  };

  // Prefetch adjacent pages so navigation is instant once the current page is
  // cached. An effect event reads the current request without adding the
  // freshly-built request object to the dependency list below, which would
  // re-run this on every render.
  const prefetchPage = useEffectEvent((index: number) => {
    if (index < 0 || index * pageSize >= totalItems) return;
    void queryClient
      .query({
        ...collectionQueryOptions(dataRepository, resource, {
          ...collectionRequest,
          page: index + 1,
        }),
        staleTime: staleTimeMs,
      })
      .catch(noop);
  });

  useEffect(() => {
    if (!totalItems) return;
    prefetchPage(pageIndex + 1);
    prefetchPage(pageIndex - 1);
  }, [pageIndex, totalItems, combinedQuery, sortingKey, resource]);

  const loadedRows = collection?.rows ?? emptyRows;
  const displayedRows = keywordMode === "loaded" && deferredLoadedKeyword
    ? loadedRows.filter((row) =>
        Object.values(row).some((value) => {
          const values = Array.isArray(value) ? value : [value];
          return values.some((item) =>
            String(item ?? "").toLowerCase().includes(deferredLoadedKeyword),
          );
        }),
      )
    : loadedRows;
  const displayedTotal = keywordMode === "loaded" && deferredLoadedKeyword
    ? displayedRows.length
    : totalItems;
  const errorMessage = error
    ? `Error: ${formatUserFacingErrorMessage(error, "Unknown error")} — Query: ${JSON.stringify(q)}`
    : undefined;

  const handleRowSelectionChange = (newSelection: RowSelectionState) => {
    // Apply new selection from table. Avoiding aggressive ignores here so
    // header "select all" and explicit deselect actions work reliably.
    setRowSelection(newSelection);

    // Clear all pages selection when individual rows change
    if (isAllPagesSelected) {
      setIsAllPagesSelected(false);
    }

    const selectedIds = Object.keys(newSelection);

    // Pre-populate the detail panel's query cache from already-fetched page data so
    // GenomeDetailPanel renders instantly (no loading flash) without an extra fetch.
    if (selectedIds.length === 1 && collection) {
      const id = selectedIds[0];
      const row = findPageRow(collection.rows, idField, id);
      if (row) queryClient.setQueryData(detailPanelQueryKey(resource, id), row);
      onSelectedRowChange?.(row ?? null);
    } else {
      onSelectedRowChange?.(null);
    }

    onSelectionChange?.(selectedIds);
  };

  const handleAllPagesSelectionChange = (selected: boolean) => {
    setIsAllPagesSelected(selected);
    onAllPagesSelectionChange?.(selected);

    onSelectedRowChange?.(null);
    if (!selected) {
      // When deselecting all pages, clear the per-row selection too. Selecting
      // all pages only raises the flag: the export path reads the flag rather
      // than a materialized id list, so there is nothing to fetch here.
      setRowSelection({});
      onSelectionChange?.([]);
    }
  };

  const handlePageChange = (newPage: number) => {
    // Update page index (this will call parent's setPageIndex if controlled)
    setPageIndex(newPage);
  };

  /**
   * Columns to project for an export. `__select__` is the checkbox column
   * rather than a data field, so it is stripped; the full projection stands in
   * when nothing else is visible, because the gateway's export operation
   * requires at least one field (`fields: fieldListSchema.min(1)`).
   */
  function exportProjection(visibleColumns: string[] | null): string[] {
    const requested = (visibleColumns ?? projection).filter(
      (id) => id !== "__select__",
    );
    return requested.length ? requested : projection;
  }

  async function handleDownloadAll(
    format: "csv" | "txt",
    visibleColumns: string[] | null,
  ): Promise<void> {
    const hasLoadedKeyword = keywordMode === "loaded" && Boolean(deferredLoadedKeyword);
    const exportTotal = hasLoadedKeyword ? displayedRows.length : totalItems;
    if (!exportTotal) {
      console.warn("No results available for download");
      return;
    }

    // The aggregate read is capped at the gateway (`maxExportRows`), which
    // would otherwise silently truncate the file. Say so instead of shipping a
    // short export.
    if (!hasLoadedKeyword && exportTotal > maxExportRows) {
      alert(
        `This export matches ${exportTotal.toLocaleString()} rows. Narrow the results to ${maxExportRows.toLocaleString()} rows or fewer and try again.`,
      );
      return;
    }

    try {
      if (hasLoadedKeyword) {
        downloadLoadedResourceRows({
          resource,
          rows: displayedRows,
          format,
          visibleColumns,
          fields,
        });
        return;
      }
      const result = await dataRepository.exportAll(resource, {
        rql: combinedQuery || undefined,
        fields: exportProjection(visibleColumns),
        sort,
      });
      downloadLoadedResourceRows({
        resource,
        rows: result.rows,
        format,
        visibleColumns,
        fields,
      });
    } catch (error) {
      console.error("Download all failed:", error);
      alert(
        formatUserFacingErrorMessage(
          error,
          "Failed to download all results. See console for details.",
        ),
      );
    }
  }

  // Selected-row export goes through the Data API repository (`/api/data/<resource>`),
  // never a direct fetch to the backend. Rows come back in whatever order the
  // upstream service returns them, so they're re-sorted to match `ids` — the order
  // the caller (and the user's selection) presented them in — before serializing.
  //
  // Order-preservation caveat (applied equally to the DataTable-internal
  // `selectedItemsOrder` Map this replaced): `ids` ultimately comes from
  // `Object.keys(rowSelection)` in handleRowSelectionChange above. Plain JS objects
  // enumerate keys that look like canonical array indices (e.g. "0", "5") in
  // ascending numeric order *before* any insertion-ordered string keys, regardless
  // of click order. This is a pre-existing, inherent quirk of object key enumeration,
  // not something introduced or fixed here.
  async function handleDownloadSelected(
    format: "csv" | "txt",
    ids: string[],
    visibleColumns: string[] | null,
  ): Promise<void> {
    if (ids.length === 0) return;

    try {
      const selectedFields = exportProjection(visibleColumns);
      const result = await dataRepository.selected(resource, {
        ids,
        fields: selectedFields,
      });
      const orderById = new Map(ids.map((id, index) => [id, index]));
      const orderedRows = [...result.rows].sort(
        (a, b) =>
          (orderById.get(String(a[idField])) ?? Number.MAX_VALUE) -
          (orderById.get(String(b[idField])) ?? Number.MAX_VALUE),
      );
      downloadResourceExport(
        resource,
        orderedRows,
        fields,
        selectedFields,
        format,
        "selected",
      );
    } catch (error) {
      console.error("Download selected failed:", error);
      alert(
        formatUserFacingErrorMessage(
          error,
          "Failed to download selected results. See console for details.",
        ),
      );
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <span ref={notifyTotalItems} hidden />
      <FilterBar
        facetFields={facetFields}
        resource={resource}
        query={cleanQ}
        keywordValue={keywordMode === "loaded" ? loadedKeyword : keywordValue}
        onKeywordChange={keywordMode === "loaded" ? setLoadedKeyword : onKeywordChange}
        keywordMode={keywordMode}
        onFilterChange={(rql) => {
          setFilter(rql);
          setPageIndex(0);
          setRowSelection({});
          onSelectionChange?.([]);
          setIsAllPagesSelected(false);
        }}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DataTable
          id={widget.id}
          data={displayedTotal === 0 ? emptyRows : displayedRows}
          columns={widget.columns}
          resource={resource}
          errorMessage={errorMessage}
          rowSelection={rowSelection}
          onRowSelectionChange={handleRowSelectionChange}
          onSelectionChange={noop}
          pageIndex={keywordMode === "loaded" && deferredLoadedKeyword ? 0 : pageIndex}
          pageSize={pageSize}
          totalItems={displayedTotal}
          onPageChange={handlePageChange}
          sorting={sorting}
          onSortingChange={setSortingAndResetPage}
          columnOrder={columnOrder}
          onColumnOrderChange={setColumnOrder}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          isAllPagesSelected={isAllPagesSelected}
          onAllPagesSelectionChange={handleAllPagesSelectionChange}
          onDownloadAll={handleDownloadAll}
          onDownloadSelected={handleDownloadSelected}
          isLoading={isLoading || isPlaceholderData}
          selectedIds={selectedIds ?? []}
        />
      </div>
    </div>
  );
}

export function ListData(props: ListDataProps) {
  return useListData(props);
}
