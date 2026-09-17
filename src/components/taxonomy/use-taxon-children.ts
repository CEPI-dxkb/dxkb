"use client";

import { useQuery } from "@tanstack/react-query";

import { TaxonomyTreeRepository } from "@/lib/data-api/taxonomy-tree-client";

import type { TaxonRecord } from "./taxon-tree-types";

/**
 * The Taxa Tree's React Query layer over the same-origin `/api/taxonomy-tree`
 * boundary. Everything about the upstream request — the `gt(genomes,1)`
 * predicate, `sort(+taxon_name)`, the `taxonChildrenPageSize` range bound,
 * `Content-Range` paging, and the `facet_counts` header contract — now lives
 * server-side in
 * `src/lib/data-api/taxonomy-tree.ts`, so this module reads no environment
 * variable and issues no request of its own.
 */
const taxonomyTreeRepository = new TaxonomyTreeRepository();

/** React Query key for a node's children — shared by the single hook and the tree's useQueries. */
export function taxonChildrenKey(parentId: number) {
  return ["taxon-children", parentId] as const;
}

/**
 * Every child of a taxon node.
 *
 * The route validates each row with `taxonomyRecordSchema`, which requires a
 * positive-integer `taxon_id` and leaves the rest optional. `TaxonRecord`
 * additionally declares `taxon_name` and `taxon_rank` as required, which is the
 * tree's own assumption about real taxonomy documents rather than something the
 * schema enforces — unchanged from the unvalidated cast this replaced.
 */
export async function fetchTaxonChildren(
  parentId: number,
  signal?: AbortSignal,
): Promise<TaxonRecord[]> {
  const rows = await taxonomyTreeRepository.children(parentId, signal);
  return rows as TaxonRecord[];
}

/** React Query key for a batch of nodes' child counts. Sorted so key is order-independent. */
export function taxonChildCountsKey(ids: number[]) {
  return [
    "taxon-child-counts",
    [...ids].sort((a, b) => a - b).join(","),
  ] as const;
}

/**
 * Child counts for many parents in one request. Parents with 0 qualifying
 * children are absent from the map (→ no expand arrow).
 */
export function fetchTaxonChildCounts(
  parentIds: number[],
  signal?: AbortSignal,
): Promise<Map<number, number>> {
  return taxonomyTreeRepository.childCounts(parentIds, signal);
}

/** Batch child counts for the currently-visible collapsed nodes. Drives expand arrows. */
export function useTaxonChildCounts(ids: number[]) {
  return useQuery<Map<number, number>>({
    queryKey: taxonChildCountsKey(ids),
    enabled: ids.length > 0,
    staleTime: Infinity,
    queryFn: ({ signal }) => fetchTaxonChildCounts(ids, signal),
  });
}
