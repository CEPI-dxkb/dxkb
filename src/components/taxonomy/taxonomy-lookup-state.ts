import type { UseQueryResult } from "@tanstack/react-query";

import { formatPrefixedErrorMessage } from "@/lib/utils";

/** The parts of a taxonomy search query the lookup state reads. */
export type TaxonomyLookupQuery = Pick<
  UseQueryResult,
  "isLoading" | "isFetching" | "isError" | "error" | "refetch"
>;

export interface TaxonomyLookupState {
  /** The search (a first load, or a Retry of a failed one) is in flight. */
  loading: boolean;
  /** The failed search, prefixed with what failed; null otherwise. */
  error: string | null;
  /** Runs the failed search again. */
  retry: () => void;
}

/**
 * What a taxonomy selector shows for its search query: the proxy's reason
 * behind what failed ("Taxonomy search unavailable: BV-BRC Taxonomy API
 * error: 503 Service Unavailable"), and a Retry, which shows as searching:
 * a query with no results yet goes back to pending when it refetches, and
 * one that kept an earlier search's results stays in error while it
 * refetches, so that error is hidden until the Retry answers.
 */
export function taxonomyLookupState(
  query: TaxonomyLookupQuery,
): TaxonomyLookupState {
  const retrying = query.isError && query.isFetching;
  return {
    loading: query.isLoading || retrying,
    error:
      query.isError && !retrying
        ? formatPrefixedErrorMessage("Taxonomy search unavailable", query.error)
        : null,
    retry: () => {
      void query.refetch();
    },
  };
}
