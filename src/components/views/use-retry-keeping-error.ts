"use client";

import { useState } from "react";

interface RetryableQuery {
  error: unknown;
  /** A read is in flight (TanStack's `isFetching`). */
  isFetching: boolean;
  refetch: () => unknown;
}

interface PendingRetry {
  error: unknown;
  identity: string;
}

/**
 * Keeps a failed query's error on screen while its Retry is in flight.
 *
 * TanStack resets a query that has no data to `pending`, error cleared, the
 * moment it refetches, so a Retry swapped the alert for loading skeletons for
 * the whole wait (~20 s against a down Data API) and then flashed it back.
 * With this the alert stays, its button reads "Retrying…", and only the
 * retry's own answer (rows, or the new error) replaces it.
 *
 * `identity` names the query the error belongs to; a different one (another
 * filter picked meanwhile) drops the kept error, since it is not that query's.
 */
export function useRetryKeepingError(
  { error, isFetching, refetch }: RetryableQuery,
  identity = "",
) {
  const [pending, setPending] = useState<PendingRetry | null>(null);
  // Settled: the retry has answered (a new error or none), or the query moved on.
  const settled =
    pending !== null &&
    (pending.identity !== identity ||
      (!isFetching && (error == null || error !== pending.error)));
  if (settled) setPending(null);
  const retrying = pending !== null && !settled;
  const shownError: unknown = error ?? (retrying ? pending.error : null);

  return {
    /** The error to show: the query's own, or the one a retry in flight keeps. */
    error: shownError,
    retrying,
    retry: () => {
      setPending({ error, identity });
      void refetch();
    },
  };
}
