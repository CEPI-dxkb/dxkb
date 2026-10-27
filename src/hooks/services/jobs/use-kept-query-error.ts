"use client";

import { useState } from "react";

interface PolledQueryResult {
  error: unknown;
  /**
   * The query holds its own data. Placeholder data (`keepPreviousData`) is
   * another key's rows and does not count.
   */
  hasData: boolean;
}

/**
 * The error to show for a polled query that has no data of its own.
 *
 * TanStack puts a query with no data back to `pending`, error cleared, the
 * moment it refetches, and that includes every background poll. During an
 * outage each back-off poll would then swap the error for a loading state (or,
 * with `keepPreviousData`, for another page's rows) for the whole wait, and
 * then flash it back. This keeps the last error of each `identity` (the
 * query's key, serialized) until that query has data again, so the error
 * stays up while it is polled, and comes back at once when the user returns
 * to a page that failed. A new error replaces the kept one.
 *
 * Pair it with `useRetryKeepingError` (fed this hook's error) for a Retry
 * button that shows "Retrying…".
 */
export function useKeptQueryError(
  { error, hasData }: PolledQueryResult,
  identity = "",
): unknown {
  const [kept, setKept] = useState<Readonly<Record<string, unknown>>>({});
  const keptError = Object.hasOwn(kept, identity) ? kept[identity] : undefined;

  // Only a query without data needs its error kept: one with data keeps the
  // error through a refetch itself, and its data answers the kept one.
  if (hasData) {
    if (keptError !== undefined) {
      setKept(
        Object.fromEntries(
          Object.entries(kept).filter(([key]) => key !== identity),
        ),
      );
    }
  } else if (error != null && keptError !== error) {
    setKept({ ...kept, [identity]: error });
  }

  if (error != null) return error;
  if (hasData) return null;
  return keptError ?? null;
}
