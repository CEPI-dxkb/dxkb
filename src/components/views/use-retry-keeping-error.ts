"use client";

import { useState } from "react";

interface RetryableQuery {
  error: unknown;
  isFetching: boolean;
  refetch: () => unknown;
}

interface PendingRetry {
  error: unknown;
  identity: string;
}

/**
 * TanStack resets a query with no data to `pending` on refetch, which would
 * swap the alert for skeletons during Retry; this keeps the error until the
 * retry answers.
 */
export function useRetryKeepingError(
  { error, isFetching, refetch }: RetryableQuery,
  identity = "",
) {
  const [pending, setPending] = useState<PendingRetry | null>(null);
  const settled =
    pending !== null &&
    (pending.identity !== identity ||
      (!isFetching && (error == null || error !== pending.error)));
  if (settled) setPending(null);
  const retrying = pending !== null && !settled;
  const shownError: unknown = error ?? (retrying ? pending.error : null);

  return {
    error: shownError,
    retrying,
    retry: () => {
      setPending({ error, identity });
      void refetch();
    },
  };
}
