"use client";

import { useState } from "react";

interface PolledQueryResult {
  error: unknown;
  /** Placeholder data (`keepPreviousData`) is another key's rows and does not count. */
  hasData: boolean;
}

/**
 * The error to show for a polled query with no data of its own. TanStack clears a data-less query's error on every refetch, so this keeps the last error per `identity` until that query has data again.
 */
export function useKeptQueryError(
  { error, hasData }: PolledQueryResult,
  identity = "",
): unknown {
  const [kept, setKept] = useState<Readonly<Record<string, unknown>>>({});
  const keptError = Object.hasOwn(kept, identity) ? kept[identity] : undefined;

  // A query with data keeps its error through a refetch itself.
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
