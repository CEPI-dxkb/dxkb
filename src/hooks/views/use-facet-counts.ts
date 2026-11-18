"use client";

import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  type DataRepository,
  type DataResource,
  type FacetBucket,
  facetCountQueryOptions,
} from "@/lib/data-api";
import { noop } from "@/lib/utils";

export type ResourceFacets = Partial<Record<string, FacetBucket[]>>;
/** `stale`: the previous scope's counts while this one's load. */
export type FacetStatus = "loading" | "stale" | "ready";

export interface UseFacetCountsOptions {
  repository: DataRepository;
  resource: DataResource;
  idField: string;
  /** Empty until the user reaches for the filters; no field is counted then. */
  facetFields: readonly string[];
  /** Scope for one field's counts, with that field's own filter left out and any explicit rql already folded in. */
  rqlFor: (field: string) => string | undefined;
  keyword?: string;
  keywordMode?: "exact" | "prefix";
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

export function useFacetCounts({
  repository,
  resource,
  idField,
  facetFields,
  rqlFor,
  keyword,
  keywordMode,
}: UseFacetCountsOptions) {
  const queryClient = useQueryClient();
  // Facet counts are the slow part of a collection read, so each field has its own query; paging and sorting fetch rows only.
  const facetQueryOptions = (field: string) => ({
    ...facetCountQueryOptions(
      repository,
      resource,
      {
        rql: rqlFor(field),
        keyword,
        keywordMode,
        pageSize: 1,
        fields: [idField],
      },
      field,
    ),
    // A new scope is a new observer per field, which `keepPreviousData` never sees; `shownFacets` keeps the previous counts on screen.
    staleTime: 30_000,
  });

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

  return {
    facets: facetsChanged ? facets : shownFacets,
    facetsError,
    facetStatuses,
    isFacetsLoading: facetFields.some(
      (field) => facetStatuses[field] === "loading",
    ),
    isFacetsRefreshing: facetFields.some(
      (field) => facetStatuses[field] === "stale",
    ),
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
  };
}
