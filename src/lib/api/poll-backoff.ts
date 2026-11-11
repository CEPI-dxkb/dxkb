import type { QueryState } from "@tanstack/react-query";

export const firstErrorPollIntervalMs = 30_000;
export const maxErrorPollIntervalMs = 300_000;

interface PolledQuery {
  state: Pick<QueryState, "status" | "errorUpdateCount">;
}

// TanStack resets fetchFailureCount on every fetch, so failed polls in a row are counted from the `errorUpdateCount` at the last success.
const errorCountAtLastSuccess = new WeakMap<PolledQuery, number>();

/** Polling interval after a failed poll, or `undefined` (use the normal interval): 30 s doubling to 5 min per failed poll in a row. Call from a `refetchInterval` function. */
export function errorBackoffPollInterval(query: PolledQuery): number | undefined {
  const { status, errorUpdateCount } = query.state;
  if (status !== "error") {
    if (status === "success") errorCountAtLastSuccess.set(query, errorUpdateCount);
    return undefined;
  }
  const failedPolls = errorUpdateCount - (errorCountAtLastSuccess.get(query) ?? 0);
  return Math.min(
    maxErrorPollIntervalMs,
    firstErrorPollIntervalMs * 2 ** Math.max(0, failedPolls - 1),
  );
}
