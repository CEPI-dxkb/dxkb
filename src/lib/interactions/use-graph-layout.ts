"use client";

import { hashKey, useQuery, type QueryKey } from "@tanstack/react-query";

import type { GEdge, GNode, LayoutName } from "./types";
import { interactionsGraphRequest } from "./use-interactions";

interface UseGraphLayoutOptions {
  rql: string;
  keywordValue: string;
  /**
   * `useInteractions`' `data`: the rows the nodes and edges were built from.
   * Its identity, not its timestamp, ties the positions to them (see
   * `rowsVersion`).
   */
  data: object | undefined;
  nodes: GNode[];
  edges: GEdge[];
  layout: LayoutName;
}

const rowsVersions = new WeakMap<object, number>();
let lastRowsVersion = 0;

/**
 * A stable number per distinct rows object, for the query key. TanStack's
 * structural sharing hands back the same `data` reference when a refetch
 * returns identical rows, so those keep their cached positions (and the
 * picture), while changed rows get a new reference and a new layout. Keying on
 * `dataUpdatedAt` instead moved on every refetch and reshuffled the graph.
 * Holds no row data: a WeakMap entry dies with its rows object.
 */
function rowsVersion(data: object | undefined): number {
  if (data === undefined) return 0;
  let version = rowsVersions.get(data);
  if (version === undefined) {
    lastRowsVersion += 1;
    version = lastRowsVersion;
    rowsVersions.set(data, version);
  }
  return version;
}

/**
 * The previous query laid out the same rows (same request and rows version,
 * key slots 1 and 2), so its positions line up with these nodes.
 */
function laidOutSameRows(
  previousKey: QueryKey | undefined,
  key: QueryKey,
): boolean {
  return (
    previousKey !== undefined &&
    hashKey(previousKey.slice(1, 3)) === hashKey(key.slice(1, 3))
  );
}

/**
 * The layout runner and the layout code load on demand, so the Interactions
 * tab's own chunk carries neither (the Table view never lays anything out),
 * and in the browser the layout itself runs in the worker's chunk.
 */
async function layOutGraph(
  nodes: GNode[],
  edges: GEdge[],
  layout: LayoutName,
  signal: AbortSignal,
): Promise<Float64Array> {
  const [{ requestGraphLayout }, { buildLayoutRequest }] = await Promise.all([
    import("./layout-client"),
    import("./layout-positions"),
  ]);
  return requestGraphLayout(buildLayoutRequest(nodes, edges, layout), {
    signal,
  });
}

/**
 * Node positions for the interactions graph, computed off the main thread by
 * `requestGraphLayout` and cached in TanStack Query, so a return to the Graph
 * tab reuses them instead of laying the graph out again. The key has its own
 * root, apart from the data key, so invalidating the rows does not recompute
 * layouts; the rows version in it drops positions for rows that changed.
 *
 * On a layout switch the previous positions stay as placeholder (the old
 * picture under the "Laying out…" overlay); for new rows there is none.
 */
export function useGraphLayout({
  rql,
  keywordValue,
  data,
  nodes,
  edges,
  layout,
}: UseGraphLayoutOptions) {
  const queryKey = [
    "interactions-graph-layout",
    interactionsGraphRequest(rql, keywordValue),
    rowsVersion(data),
    layout,
  ] as const;

  return useQuery({
    queryKey,
    queryFn: ({ signal }) => layOutGraph(nodes, edges, layout, signal),
    enabled: nodes.length > 0,
    staleTime: Infinity,
    retry: false,
    placeholderData: (previousData, previousQuery) =>
      laidOutSameRows(previousQuery?.queryKey, queryKey)
        ? previousData
        : undefined,
  });
}
