"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { RowSelectionState, SortingState } from "@tanstack/react-table";
import { dataSort, type CollectionState } from "@/lib/views/collection-state";
import {
  collectionQueryOptions,
  type DataRepository,
  type DataResource,
  type DataSort,
  type FacetBucket,
  memberQueryOptions,
} from "@/lib/data-api";
import { noop } from "@/lib/utils";
import { resourceCollectionPageSize } from "./collection-state";
export type ResourceRow = Record<string, unknown>;
export type ResourceFacets = Partial<Record<string, FacetBucket[]>>;

export interface UseResourceCollectionOptions {
  repository: DataRepository;
  resource: DataResource;
  idField: string;
  fields: readonly string[];
  detailFields?: readonly string[];
  /**
   * The facets to count, which is exactly the set requested; empty requests
   * none. `ResourceCollection` passes only what its filter panel shows.
   */
  facetFields?: readonly string[];
  /**
   * Fetch the page after the current one in the background. Required so the
   * default lives in one place: `ResourceCollection`, the only caller.
   */
  prefetchNextPage: boolean;
  structuralRql?: string;
  /**
   * The facet counts' own structural RQL, when it differs from the rows' (see
   * `ResourceCollection`'s `facetState`). Omitted: counts use `structuralRql`.
   * An object, so a scope with no predicate stays distinct from "omitted".
   */
  facetScope?: { structuralRql: string | undefined };
  serverKeywordMode?: "exact" | "prefix";
  /**
   * The order rows are read in while no column is sorted (`"unsorted"`), such
   * as a legacy grid's default order. No column shows it as its sort, as
   * legacy's do not. Unset leaves the order to the backend.
   */
  unsortedOrder?: DataSort;
  state: CollectionState;
  onStateChange: (state: CollectionState) => void;
}

const emptyFacets: ResourceFacets = {};

function combineRql(...parts: (string | undefined)[]) {
  const predicates = parts.filter((part): part is string => part !== undefined);
  if (predicates.length === 0) return undefined;
  if (predicates.length === 1) return predicates[0];
  return `and(${predicates.join(",")})`;
}

export function useResourceCollection<Row extends ResourceRow>({
  repository,
  resource,
  idField,
  fields,
  detailFields = fields,
  facetFields = [],
  prefetchNextPage,
  structuralRql,
  facetScope,
  serverKeywordMode,
  unsortedOrder,
  state,
  onStateChange,
}: UseResourceCollectionOptions) {
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [isAllPagesSelected, setIsAllPagesSelected] = useState(false);
  const rql = combineRql(structuralRql, state.rql);
  const facetRql = combineRql(
    facetScope ? facetScope.structuralRql : structuralRql,
    state.rql,
  );
  const queryIdentity = JSON.stringify([
    resource,
    structuralRql,
    state.rql,
    state.keyword,
    state.filters,
  ]);
  const [previousQueryIdentity, setPreviousQueryIdentity] =
    useState(queryIdentity);
  if (previousQueryIdentity !== queryIdentity) {
    setPreviousQueryIdentity(queryIdentity);
    setSelection({});
    setIsAllPagesSelected(false);
  }
  const request = useMemo(
    () => ({
      rql,
      keyword: state.keyword,
      keywordMode: serverKeywordMode,
      page: state.page,
      pageSize: resourceCollectionPageSize,
      sort: dataSort(state.sort) ?? unsortedOrder,
      fields: [...fields],
    }),
    [
      fields,
      rql,
      serverKeywordMode,
      state.keyword,
      state.page,
      state.sort,
      unsortedOrder,
    ],
  );
  // Facet counts depend on the scope, not on the page or sort, and they are the
  // expensive part of a collection read (Genome's 38 facets are ~10 s of an
  // ~11 s request). Their own query means paging, sorting and the next-page
  // prefetch fetch rows only, and the table does not wait for the counts.
  const facetRequest = useMemo(
    () => ({
      rql: facetRql,
      keyword: state.keyword,
      keywordMode: serverKeywordMode,
      pageSize: 1,
      fields: [idField],
      facets: [...facetFields],
    }),
    [facetFields, facetRql, idField, serverKeywordMode, state.keyword],
  );

  const query = useQuery(
    collectionQueryOptions<Row>(repository, resource, request),
  );
  const facetQuery = useQuery({
    ...collectionQueryOptions(repository, resource, facetRequest),
    enabled: facetFields.length > 0,
    // Counts change with the scope only and are the slow part of a read, so a
    // remount inside this window (a tab switch and back) reuses them.
    staleTime: 30_000,
  });
  const total = query.data?.total ?? 0;
  useEffect(() => {
    if (!prefetchNextPage || query.isPlaceholderData) return;
    if (state.page * resourceCollectionPageSize >= total) return;
    const nextRequest = { ...request, page: state.page + 1 };
    void queryClient
      .query({
        ...collectionQueryOptions(repository, resource, nextRequest),
        staleTime: 5 * 60 * 1000,
      })
      .catch(noop);
  }, [
    prefetchNextPage,
    query.isPlaceholderData,
    queryClient,
    repository,
    request,
    resource,
    state.page,
    total,
  ]);
  const rows = query.data?.rows;
  const visibleRows = rows ?? [];
  const selectedIds = Object.keys(selection);
  const activeId =
    !isAllPagesSelected && selectedIds.length === 1 ? selectedIds[0] : null;

  const detailQuery = useQuery({
    ...memberQueryOptions<Row>(repository, resource, {
      id: activeId ?? "",
      idField,
      fields: [...detailFields],
    }),
    enabled: activeId !== null,
  });
  // The loaded page already holds the selected row's columns, so the panel
  // shows it at once and the member read fills in the detail-only fields when
  // it returns. A row selected on another page has no stand-in and waits.
  const pageRow =
    activeId === null
      ? undefined
      : visibleRows.find((row) => String(row[idField]) === activeId);
  const activeSort = dataSort(state.sort);
  const sorting: SortingState = activeSort
    ? [{ id: activeSort.field, desc: activeSort.direction === "desc" }]
    : [];

  return {
    activeId,
    /**
     * This query's total: the cached one, or, while the rows on screen are a
     * previous query's placeholder, its own read's once that lands. It joins
     * the read in flight rather than sending another, and rejects with
     * `CancelledError` when the query is replaced before the read lands.
     */
    currentTotal: async () =>
      (
        await queryClient.query({
          ...collectionQueryOptions<Row>(repository, resource, request),
          staleTime: "static",
        })
      ).total,
    detail: detailQuery.data?.row ?? pageRow ?? null,
    detailError: detailQuery.error,
    facets: facetQuery.data?.facets ?? emptyFacets,
    facetsError: facetQuery.error,
    isAllPagesSelected,
    // Nothing to show yet: the member read is pending and no loaded row stands in.
    isDetailLoading: detailQuery.isLoading && pageRow === undefined,
    // No counts to show yet, not even a previous scope's.
    isFacetsLoading: facetQuery.isLoading,
    // The counts on screen belong to the previous scope or facet set.
    isFacetsRefreshing: facetQuery.isPlaceholderData,
    isInitialLoading: query.isLoading,
    isRefreshing: query.isFetching && !query.isLoading,
    // The rows and total on screen belong to a previous query (another page,
    // sort or scope) while this one loads; a same-query refresh is not this.
    isPlaceholderData: query.isPlaceholderData,
    // The rows on screen belong to another page (a page that was not
    // prefetched is still loading), so the table shows its loading skeleton
    // rather than rows the user has paged away from. Their total still sizes the
    // pager. A same-page change (sort, filter, keyword) keeps them on screen.
    isPageLoading: query.isPlaceholderData && query.data.page !== state.page,
    error: query.error,
    refetch: query.refetch,
    refetchFacets: facetQuery.refetch,
    rows: visibleRows,
    selection,
    selectedIds,
    sorting,
    total,
    setIsAllPagesSelected,
    setSelection,
    setPageIndex: (pageIndex: number) => {
      onStateChange({ ...state, page: pageIndex + 1 });
    },
    setSorting: (next: SortingState) => {
      const primary = next[0];
      onStateChange({
        ...state,
        page: 1,
        sort: `${primary.id}:${primary.desc ? "desc" : "asc"}`,
      });
    },
  };
}
