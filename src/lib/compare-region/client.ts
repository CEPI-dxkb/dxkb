/**
 * Answers are cached by TanStack Query only, so `queryClient.clear()` on an
 * account change covers them; nothing registers with `account-caches`.
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
  if (query.group !== null) params.set("group", query.group);
  const response = await fetch(`/api/compare-region?${toQueryString(params)}`, {
    credentials: "include",
  });
  if (!response.ok) throw await httpFailure(response, "Compare Region Viewer");
  return ((await response.json()) as CompareRegionResult).rows;
}

/** Retrying cannot help: the user has to sign in or choose a public source. */
export function isCompareRegionSignInError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { status?: unknown }).status === 401
  );
}
