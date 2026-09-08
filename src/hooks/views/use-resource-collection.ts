"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { RowSelectionState, SortingState } from "@tanstack/react-table";
import type { CollectionState } from "@/lib/views/collection-state";
import {
  collectionQueryOptions,
  type DataRepository,
  type DataResource,
  type FacetBucket,
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
  facetFields?: readonly string[];
  prefetchNextPage?: boolean;
  structuralRql?: string;
  serverKeywordMode?: "exact" | "prefix";
  state: CollectionState;
  onStateChange: (state: CollectionState) => void;
}

const emptyFacets: ResourceFacets = {};

export function selectedIdsFromSelection(
  selection: RowSelectionState,
): string[] {
  return Object.keys(selection);
}

function combineRql(...parts: (string | undefined)[]) {
  const predicates = parts.filter((part): part is string => part !== undefined);
  if (predicates.length === 0) return undefined;
  if (predicates.length === 1) return predicates[0];
  return `and(${predicates.join(",")})`;
}

function dataSort(sort: string) {
  if (sort === "unsorted") return undefined;
  const [field, direction] = sort.split(":");
  return {
    field,
    direction: direction === "desc" ? ("desc" as const) : ("asc" as const),
  };
}

export function useResourceCollection<Row extends ResourceRow>({
  repository,
  resource,
  idField,
  fields,
  detailFields = fields,
  facetFields = [],
  prefetchNextPage = false,
  structuralRql,
  serverKeywordMode,
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
      sort: dataSort(state.sort),
      fields: [...fields],
      facets: [...facetFields],
    }),
    [facetFields, fields, rql, serverKeywordMode, state.keyword, state.page, state.sort],
  );

  const query = useQuery(
    collectionQueryOptions<Row>(repository, resource, request),
  );
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
  const selectedIds = selectedIdsFromSelection(selection);
  const activeId =
    !isAllPagesSelected && selectedIds.length === 1 ? selectedIds[0] : null;

  const detailQuery = useQuery({
    queryKey: ["resource-detail", resource, idField, activeId],
    queryFn: ({ signal }) =>
      repository.member<Row>(
        resource,
        { id: activeId ?? "", idField, fields: [...detailFields] },
        signal,
      ),
    enabled: activeId !== null,
  });
  const activeSort = dataSort(state.sort);
  const sorting: SortingState = activeSort
    ? [{ id: activeSort.field, desc: activeSort.direction === "desc" }]
    : [];

  return {
    activeId,
    detail:
      detailQuery.data?.row ??
      visibleRows.find((row) => String(row[idField]) === activeId) ??
      null,
    detailError: detailQuery.error,
    facets: query.data?.facets ?? emptyFacets,
    isAllPagesSelected,
    isDetailLoading: detailQuery.isLoading,
    isInitialLoading: query.isLoading,
    isRefreshing: query.isFetching && !query.isLoading,
    error: query.error,
    refetch: query.refetch,
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
