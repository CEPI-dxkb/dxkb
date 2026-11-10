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
/** `stale`: the previous scope's counts while this one's load. */
export type FacetStatus = "loading" | "stale" | "ready";

export interface UseResourceCollectionOptions {
  repository: DataRepository;
  resource: DataResource;
  idField: string;
  fields: readonly string[];
  detailFields?: readonly string[];
  facetFields?: readonly string[];
  prefetchNextPage: boolean;
  structuralRql?: string;
  /** `ResourceCollection` leaves the field's own filter out (multi-select faceting); omitted uses `structuralRql`. */
  facetStructuralRql?: (field: string) => string | undefined;
  serverKeywordMode?: "exact" | "prefix";
  /** Row order while no column is sorted; not shown as a column sort. */
  unsortedOrder?: DataSort;
  state: CollectionState;
  onStateChange: (state: CollectionState) => void;
}

const emptyFacets: ResourceFacets = {};
// One instance so a field with no buckets keeps its identity across renders.
const noBuckets: FacetBucket[] = [];

function facetStatusOf(
  fresh: boolean,
  shown: boolean,
  pending: boolean,
): FacetStatus {
  if (fresh) return "ready";
  if (shown) return "stale";
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
  // Facet counts are the slow part of a collection read, so each field has its own query; paging and sorting fetch rows only.
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
    // A new scope is a new observer per field, which `keepPreviousData` never sees; `shownFacets` keeps the previous counts on screen.
    staleTime: 30_000,
  });

  const query = useQuery(
    collectionQueryOptions<Row>(repository, resource, request),
  );
  const facetQueries = useQueries({
    queries: facetFields.map((field) => facetQueryOptions(field)),
  });
  const freshFacets: ResourceFacets = {};
  facetFields.forEach((field, index) => {
    const data = facetQueries[index]?.data;
    if (data) freshFacets[field] = data.facets[field] ?? noBuckets;
  });
  // Pending fields keep the previous scope's counts; a failed read drops them.
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
    /** Rejects with `CancelledError` when the query is replaced before the read lands. */
    currentTotal: async () =>
      (
        await queryClient.query({
          ...collectionQueryOptions<Row>(repository, resource, request),
          staleTime: "static",
        })
      ).total,
    detail: detailQuery.data?.row ?? pageRow ?? null,
    detailError: detailQuery.error,
    facets: facetsChanged ? facets : shownFacets,
    facetsError,
    facetStatuses,
    isAllPagesSelected,
    isDetailLoading: detailQuery.isLoading && pageRow === undefined,
    isFacetsLoading: facetFields.some(
      (field) => facetStatuses[field] === "loading",
    ),
    isFacetsRefreshing: facetFields.some(
      (field) => facetStatuses[field] === "stale",
    ),
    isInitialLoading: query.isLoading,
    isRefreshing: query.isFetching && !query.isLoading,
    isPlaceholderData: query.isPlaceholderData,
    // A page that was not prefetched shows the skeleton, not rows the user paged away from; a same-page change keeps them.
    isPageLoading: query.isPlaceholderData && query.data.page !== state.page,
    error: query.error,
    refetch: query.refetch,
    refetchFacets: async () => {
      const failed = facetQueries.filter((facetQuery) => facetQuery.error);
      await Promise.all(
        (failed.length > 0 ? failed : facetQueries).map((facetQuery) =>
          facetQuery.refetch(),
        ),
      );
    },
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
