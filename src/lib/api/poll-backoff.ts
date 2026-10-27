import type { QueryState } from "@tanstack/react-query";

export const firstErrorPollIntervalMs = 30_000;
export const maxErrorPollIntervalMs = 300_000;

interface PolledQuery {
  state: Pick<QueryState, "status" | "errorUpdateCount">;
}

// The query's errorUpdateCount when it last succeeded. TanStack resets
// fetchFailureCount at the start of every fetch, so it only counts the retries
// of one poll; the distance from this baseline counts failed polls in a row.
const errorCountAtLastSuccess = new WeakMap<PolledQuery, number>();

/**
 * Polling interval for a query whose last poll failed, or `undefined` when it
 * did not (use the normal interval then). Starts at 30 s and doubles with each
 * failed poll in a row up to 5 min, so a dead backend is not polled at the
 * fast "jobs running" rate. The next successful poll restores the normal rate.
 *
 * Call it from a `refetchInterval` function, which runs on every query update.
 */
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
