"use client";

import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { RowSelectionState, SortingState } from "@tanstack/react-table";
import { dataSort, type CollectionState } from "@/lib/views/collection-state";
import {
  collectionQueryOptions,
  type DataRepository,
  facetCountQueryOptions,
  type DataResource,
  type DataSort,
  type FacetBucket,
  memberQueryOptions,
} from "@/lib/data-api";
import { noop } from "@/lib/utils";
import { resourceCollectionPageSize } from "./collection-state";
export type ResourceRow = Record<string, unknown>;
export type ResourceFacets = Partial<Record<string, FacetBucket[]>>;
/**
 * A counted facet's counts: none yet (`loading`), the previous scope's while
 * this one's load (`stale`), or settled (`ready`): this scope's, or none
 * because its read failed.
 */
export type FacetStatus = "loading" | "stale" | "ready";

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
   * The structural RQL one field's counts are read over, when it differs from
   * the rows': `ResourceCollection` leaves that field's own filter out, so a
   * facet lists every value it could add (multi-select faceting). Omitted:
   * counts use `structuralRql`.
   */
  facetStructuralRql?: (field: string) => string | undefined;
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
// One instance, so a field counted with no buckets keeps its identity across
// renders and `shownFacets` settles.
const noBuckets: FacetBucket[] = [];

function facetStatusOf(
  fresh: boolean,
  shown: boolean,
  pending: boolean,
): FacetStatus {
  if (fresh) return "ready";
  if (shown) return "stale";
  // A failed read with nothing to show has settled: its error says why.
  return pending ? "loading" : "ready";
}

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
  facetStructuralRql,
  serverKeywordMode,
  unsortedOrder,
  state,
  onStateChange,
}: UseResourceCollectionOptions) {
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [isAllPagesSelected, setIsAllPagesSelected] = useState(false);
  const rql = combineRql(structuralRql, state.rql);
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
  // ~11 s request). Their own queries mean paging, sorting and the next-page
  // prefetch fetch rows only, and the table does not wait for the counts.
  // One query per field, so turning one facet on reads that field alone and a
  // Retry re-reads only the failed ones; the reads of one scope started
  // together (every unfiltered field) share one request, which the server
  // counts in parallel (`facetCountQueryOptions`).
  const facetQueryOptions = (field: string) => ({
    ...facetCountQueryOptions(
      repository,
      resource,
      {
        rql: combineRql(
          facetStructuralRql ? facetStructuralRql(field) : structuralRql,
          state.rql,
        ),
        keyword: state.keyword,
        keywordMode: serverKeywordMode,
        pageSize: 1,
        fields: [idField],
      },
      field,
    ),
    // Counts change with the scope only and are the slow part of a read, so a
    // remount inside this window (a tab switch and back) reuses them. A new
    // scope is a new observer per field, which `keepPreviousData` never sees;
    // `shownFacets` below keeps the previous counts on screen instead.
    staleTime: 30_000,
  });

  const query = useQuery(
    collectionQueryOptions<Row>(repository, resource, request),
  );
  const facetQueries = useQueries({
    queries: facetFields.map((field) => facetQueryOptions(field)),
  });
  // This scope's counts, for the fields whose read has answered. A field the
  // upstream returns no buckets for was counted and has none.
  const freshFacets: ResourceFacets = {};
  facetFields.forEach((field, index) => {
    const data = facetQueries[index]?.data;
    if (data) freshFacets[field] = data.facets[field] ?? noBuckets;
  });
  // The counts on screen: this scope's where they have landed, otherwise the
  // ones shown for that field before (the previous scope's) while its read is
  // pending. A failed read drops them: they are not this scope's counts.
  const [shownFacets, setShownFacets] = useState<ResourceFacets>(emptyFacets);
  const facets: ResourceFacets = {};
  facetFields.forEach((field, index) => {
    const buckets =
      freshFacets[field] ??
      (facetQueries[index]?.isPending ? shownFacets[field] : undefined);
    if (buckets) facets[field] = buckets;
  });
  const facetKeys = Object.keys(facets);
  const facetsChanged =
    facetKeys.length !== Object.keys(shownFacets).length ||
    facetKeys.some((field) => facets[field] !== shownFacets[field]);
  if (facetsChanged)
    setShownFacets(facetKeys.length === 0 ? emptyFacets : facets);
  const facetsError =
    facetQueries.find((facetQuery) => facetQuery.error)?.error ?? null;
  // Per field: no counts yet, the previous scope's on screen, or this scope's.
  const facetStatuses: Partial<Record<string, FacetStatus>> = {};
  facetFields.forEach((field, index) => {
    facetStatuses[field] = facetStatusOf(
      Object.hasOwn(freshFacets, field),
      Object.hasOwn(facets, field),
      facetQueries[index]?.isPending ?? false,
    );
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
    // The settled object while nothing changed, so consumers see one identity.
    facets: facetsChanged ? facets : shownFacets,
    facetsError,
    facetStatuses,
    isAllPagesSelected,
    // Nothing to show yet: the member read is pending and no loaded row stands in.
    isDetailLoading: detailQuery.isLoading && pageRow === undefined,
    // A shown facet has no counts to show yet, not even a previous scope's.
    isFacetsLoading: facetFields.some(
      (field) => facetStatuses[field] === "loading",
    ),
    // A shown facet's counts on screen belong to the previous scope.
    isFacetsRefreshing: facetFields.some(
      (field) => facetStatuses[field] === "stale",
    ),
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
    /** Re-reads the failed facets, or every shown facet when none failed. */
    refetchFacets: async () => {
      const failed = facetQueries.filter((facetQuery) => facetQuery.error);
      await Promise.all(
        (failed.length > 0 ? failed : facetQueries).map((facetQuery) =>
          facetQuery.refetch(),
        ),
      );
    },
    /**
     * Starts reading these facets' counts for the current scope before they
     * are shown (the pointer is on Filters), so opening the menu joins reads
     * already in flight. Fresh counts are not read again.
     */
    prefetchFacets: (fields: readonly string[]) => {
      for (const field of fields)
        void queryClient.query(facetQueryOptions(field)).catch(noop);
    },
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
