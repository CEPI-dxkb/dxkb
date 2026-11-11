"use client";

import { hashKey, useQuery, type QueryKey } from "@tanstack/react-query";

import type { GEdge, GNode, LayoutName } from "./types";
import { interactionsGraphRequest } from "./use-interactions";

interface UseGraphLayoutOptions {
  rql: string;
  keywordValue: string;
  data: object | undefined;
  nodes: GNode[];
  edges: GEdge[];
  layout: LayoutName;
}

const rowsVersions = new WeakMap<object, number>();
let lastRowsVersion = 0;

/**
 * TanStack's structural sharing returns the same `data` reference when a refetch yields identical
 * rows, so those keep their cached positions; keying on `dataUpdatedAt` reshuffled the graph on
 * every refetch. A WeakMap entry dies with its rows object.
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
 * Loaded on demand so the Interactions tab's chunk carries neither; in the browser the layout runs
 * in the worker's chunk.
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
 * The key has its own root, apart from the data key, so invalidating rows does not recompute
 * layouts. On a layout switch the previous positions stay as placeholder; for new rows there is
 * none.
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
