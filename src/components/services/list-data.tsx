"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DataTable } from "@/components/shared/data-table";
import type { RowSelectionState, SortingState } from "@tanstack/react-table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUserFacingErrorMessage, noop } from "@/lib/utils";
import { getIdField } from "@/constants/resources";
import { detailPanelQueryKey } from "@/components/genome/genome-detail-panel-utils";
import { FilterBar } from "@/components/filterbar/filter-bar";
import { DataRepository, isDataResource } from "@/lib/data-api";
import { downloadResourceExport } from "@/components/views/resource-export";
import {
  deriveTableFields,
  downloadLoadedResourceRows,
  downloadResourceRows,
  findPageRow,
  isSameResourceQuery,
  resourceFields,
} from "./list-data-utils";

// The sanctioned browser-side Data API entrypoint (`/api/data/<resource>`) for the
// "download selected rows" export. Stateless wrapper around fetch, so a single
// module-level instance is the established pattern (see e.g.
// genome-resource-collection.tsx, use-interactions.ts).
const dataRepository = new DataRepository();

// Stable empty-rows reference so DataTable's memoized body comparator (prev.data === next.data)
// isn't defeated by a fresh [] on every render when there are no results.
const emptyRows: Record<string, unknown>[] = [];

interface ListDataProps {
  q: string;
  resource: string; // 'genome', 'gene', etc.
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

  const searchParams = useSearchParams();
  const searchtype = searchParams.get("type") ?? "";
  const cleanQ = q.split("#")[0];
  const DataAPI = process.env.NEXT_PUBLIC_DATA_API;
  if (!DataAPI) {
    throw new Error(
      "NEXT_PUBLIC_DATA_API environment variable is not configured",
    );
  }
  const pageSize = 200;

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

  const sortingKey =
    sorting.length > 0
      ? `${sorting[0].id}:${sorting[0].desc ? "desc" : "asc"}`
      : "none";

  const combinedQuery =
    !filter || filter === "false"
      ? cleanQ
      : !cleanQ
        ? filter
        : `and(${cleanQ},${filter})`;

  interface MetaResponse {
    response?: { numFound?: number };
  }

  // Fetch metadata (numFound)
  const {
    data: metaData,
    isLoading: metaLoading,
    error: metaError,
  } = useQuery<MetaResponse>({
    queryKey: ["genome-meta", resource, combinedQuery, searchtype],
    queryFn: async () => {
      const baseURL = `${DataAPI}/${resource}/?${combinedQuery}`;
      const res = await fetch(`${baseURL}&limit(1)`, {
        headers: { Accept: "application/solr+json" },
      });
      if (!res.ok)
        throw new Error(
          `Failed to fetch metadata (${String(res.status)} ${res.statusText})`,
        );
      return res.json() as Promise<MetaResponse>;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Compute totalItems safely
  const totalItems = metaData?.response?.numFound ?? 0;

  const notifyTotalItems = (node: HTMLSpanElement | null) => {
    if (node) onTotalItemsChange?.(totalItems);
  };

  // Fetch current page of data
  const {
    data: pageData,
    isLoading: dataLoading,
    isPlaceholderData,
    error: dataError,
  } = useQuery<Record<string, unknown>[]>({
    queryKey: [
      "genome-full",
      resource,
      combinedQuery,
      pageIndex,
      sortingKey,
      searchtype,
      totalItems,
    ],
    queryFn: async () => {
      if (totalItems === 0) return [];

      // Derive sort param from sortingKey (already in queryKey) to avoid stale closure
      const start = pageIndex * pageSize;
      const end = start + pageSize;

      const baseURL = `${DataAPI}/${resource}/?${combinedQuery}`;
      const sortClause =
        sortingKey !== "none"
          ? (() => {
              const [field, dir] = sortingKey.split(":");
              return `&sort(${dir === "desc" ? "-" : "+"}${field})`;
            })()
          : "";
      const fieldMap = resourceFields[resource];
      const selectIds = fieldMap
        ? [
            ...new Set([
              idField,
              ...Object.values(fieldMap).map((f) => f.field),
            ]),
          ]
        : [idField];
      const selectClause = `&select(${selectIds.join(",")})`;
      const url = `${baseURL}${sortClause}${selectClause}`;

      const res = await fetch(url, {
        headers: {
          "Content-type": "application/rqlquery+x-www-form-urlencoded",
          Accept: "application/json",
          Range: `items=${String(start)}-${String(end)}`,
          "X-Range": `items=${String(start)}-${String(end)}`,
        },
      });
      if (!res.ok)
        throw new Error(
          `Failed to fetch genome data (${String(res.status)} ${res.statusText})`,
        );
      return res.json() as Promise<Record<string, unknown>[]>;
    },
    enabled: totalItems > 0,
    // Keep previous page's rows during refetch for smooth pagination — but ONLY
    // within the same resource. On a tab switch (e.g. genome → strain) the query
    // key's resource changes; bleeding the old resource's rows into a table now
    // keyed by the new resource's idField produces duplicate/undefined React keys
    // (genome rows share a `strain`, or lack it entirely). Drop the placeholder
    // when the resource differs so the table renders empty until real rows land.
    placeholderData: (previousData, previousQuery) =>
      isSameResourceQuery(previousQuery?.queryKey, resource)
        ? previousData
        : undefined,
    staleTime: 5 * 60 * 1000,
  });

  // Prefetch adjacent pages so navigation is instant once the current page is cached.
  useEffect(() => {
    if (!totalItems) return;
    const fieldMap = resourceFields[resource];
    const selectIds = fieldMap
      ? [...new Set([idField, ...Object.values(fieldMap).map((f) => f.field)])]
      : [idField];
    const sortClause =
      sortingKey !== "none"
        ? (() => {
            const [field, dir] = sortingKey.split(":");
            return `&sort(${dir === "desc" ? "-" : "+"}${field})`;
          })()
        : "";
    const prefetchURL = `${DataAPI}/${resource}/?${combinedQuery}${sortClause}&select(${selectIds.join(",")})`;

    const prefetch = (idx: number) => {
      if (idx < 0 || idx * pageSize >= totalItems) return;
      const start = idx * pageSize;
      const end = start + pageSize;
      void queryClient
        .query({
          queryKey: [
            "genome-full",
            resource,
            combinedQuery,
            idx,
            sortingKey,
            searchtype,
            totalItems,
          ],
          queryFn: async () => {
            const res = await fetch(prefetchURL, {
              headers: {
                "Content-type": "application/rqlquery+x-www-form-urlencoded",
                Accept: "application/json",
                Range: `items=${String(start)}-${String(end)}`,
                "X-Range": `items=${String(start)}-${String(end)}`,
              },
            });
            if (!res.ok)
              throw new Error(
                `Failed to fetch genome data (${String(res.status)} ${res.statusText})`,
              );
            return res.json() as Promise<Record<string, unknown>[]>;
          },
          staleTime: 5 * 60 * 1000,
        })
        .catch(noop);
    };
    prefetch(pageIndex + 1);
    prefetch(pageIndex - 1);
  }, [
    pageIndex,
    totalItems,
    combinedQuery,
    sortingKey,
    searchtype,
    resource,
    queryClient,
    idField,
    DataAPI,
    pageSize,
  ]);

  const loadedRows = pageData ?? emptyRows;
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
  const errorMessage =
    (metaError ?? dataError)
      ? `Error: ${(metaError ?? dataError)?.message ?? "Unknown error"} — Query: ${JSON.stringify(q)}`
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
    if (selectedIds.length === 1 && pageData) {
      const id = selectedIds[0];
      const row = findPageRow(pageData, idField, id);
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
    if (selected) {
      // When selecting all pages, notify parent with all item IDs
      // For now, we'll just set the flag - actual implementation would need to fetch all IDs
    } else {
      // When deselecting all pages, clear selection
      setRowSelection({});
      onSelectionChange?.([]);
    }
  };

  const handlePageChange = (newPage: number) => {
    // Update page index (this will call parent's setPageIndex if controlled)
    setPageIndex(newPage);
  };

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

    // Check if the exported result set exceeds the download limit
    const DOWNLOAD_LIMIT = 50000;
    if (exportTotal > DOWNLOAD_LIMIT) {
      alert(
        `The download limit is ${DOWNLOAD_LIMIT.toLocaleString()} rows. Your query returned ${String(exportTotal)} rows. Please refine your search to download fewer results.`,
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
      await downloadResourceRows({
        dataApi: DataAPI ?? "",
        resource,
        query: combinedQuery,
        totalItems,
        format,
        visibleColumns,
        fields,
      });
    } catch (error) {
      console.error("Download all failed:", error);
      alert("Failed to download all results. See console for details.");
    }
  }

  // Selected-row export goes through the Data API repository (`/api/data/<resource>`),
  // never a direct fetch to the backend, for any resource the repository recognizes.
  // Rows come back in whatever order the upstream service returns them, so they're
  // re-sorted to match `ids` — the order the caller (and the user's selection)
  // presented them in — before serializing.
  //
  // Order-preservation caveat (applies to every branch below, and applied equally to
  // the DataTable-internal `selectedItemsOrder` Map this replaced): `ids` ultimately
  // comes from `Object.keys(rowSelection)` in handleRowSelectionChange above. Plain
  // JS objects enumerate keys that look like canonical array indices (e.g. "0", "5")
  // in ascending numeric order *before* any insertion-ordered string keys, regardless
  // of click order. This is a pre-existing, inherent quirk of object key enumeration,
  // not something introduced or fixed here.
  async function handleDownloadSelected(
    format: "csv" | "txt",
    ids: string[],
    visibleColumns: string[] | null,
  ): Promise<void> {
    if (ids.length === 0) return;

    if (!isDataResource(resource)) {
      // Resources outside the Data API repository (currently just genome_amr) have
      // no server-side "selected" read to fall back to — but the rows a user can
      // select are, by construction, already loaded on the client (DataTable only
      // lets you select rows it rendered). Export directly from what's already
      // loaded instead of gating the feature off. This is narrower than the
      // repository path: it only covers the currently-loaded page(s), so a
      // selected id no longer present in `displayedRows` is simply omitted rather
      // than fabricated or treated as a failure.
      const orderById = new Map(ids.map((id, index) => [id, index]));
      const selectedLoadedRows = displayedRows
        .filter((row) => orderById.has(String(row[idField])))
        .sort(
          (a, b) =>
            (orderById.get(String(a[idField])) ?? Number.MAX_VALUE) -
            (orderById.get(String(b[idField])) ?? Number.MAX_VALUE),
        );
      downloadLoadedResourceRows({
        resource,
        rows: selectedLoadedRows,
        format,
        visibleColumns,
        fields,
        variant: "selected",
      });
      return;
    }

    try {
      const selectedFields = visibleColumns ?? fields.map((field) => field.id);
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
        keywordPlaceholder={
          resource === "ppi" ? "Search interaction results..." : undefined
        }
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
          isLoading={metaLoading || dataLoading || isPlaceholderData}
          selectedIds={selectedIds ?? []}
        />
      </div>
    </div>
  );
}

export function ListData(props: ListDataProps) {
  return useListData(props);
}
