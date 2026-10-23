/**
 * Browser side of `/api/compare-region`, kept apart from `./server.ts` so no
 * Zod schema or service URL reaches a client bundle. Answers are cached by
 * TanStack Query only, so `queryClient.clear()` on an account change covers
 * them: there is no module-level cache to register with `account-caches`.
 */
import { httpFailure } from "@/lib/data-api/route-failure-client";
import { toQueryString } from "@/lib/url";
import type {
  CompareRegionQuery,
  CompareRegionResult,
  CompareRegionRow,
} from "./contract";

export const compareRegionQueryKeys = {
  all: ["compare-region"] as const,
  rows: (query: CompareRegionQuery) =>
    [...compareRegionQueryKeys.all, "rows", query] as const,
};

export async function loadCompareRegion(
  query: CompareRegionQuery,
): Promise<CompareRegionRow[]> {
  const params = new URLSearchParams({
    peg: query.peg,
    size: String(query.size),
    genomes: String(query.genomes),
    method: query.method,
    filter: query.filter,
  });
  const response = await fetch(`/api/compare-region?${toQueryString(params)}`, {
    credentials: "include",
  });
  if (!response.ok) throw await httpFailure(response, "Compare Region Viewer");
  return ((await response.json()) as CompareRegionResult).rows;
}
