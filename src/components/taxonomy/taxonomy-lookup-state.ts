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

/** What a taxonomy selector shows for its search: the proxy's reason for a failure, and a Retry whose refetch hides the stale error until it answers. */
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
