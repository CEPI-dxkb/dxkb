import type { UseQueryResult } from "@tanstack/react-query";

import { formatPrefixedErrorMessage } from "@/lib/utils";

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
 * error: 503 Service Unavailable"), and a Retry. A query with no results
 * yet goes back to pending when it refetches, so a Retry shows as searching.
 */
export function taxonomyLookupState(
  query: UseQueryResult,
): TaxonomyLookupState {
  return {
    loading: query.isLoading,
    error: query.isError
      ? formatPrefixedErrorMessage("Taxonomy search unavailable", query.error)
      : null,
    retry: () => {
      void query.refetch();
    },
  };
}
