/**
 * Statuses a server route answers when an upstream is down (unreachable,
 * unavailable, or timed out; see `src/lib/api/upstream-failure.ts`). Retrying
 * one at once only doubles the wait for the same answer: during the
 * 2026-10-19 outage every table took two 10 s attempts to admit it failed.
 */
const upstreamOutageStatuses = new Set([502, 503, 504]);

/**
 * Whether a query error is an upstream outage. Reads the `status` every
 * client error type carries (`ApiCallError`, `DataRepositoryError`,
 * `WorkspaceApiError`), so it needs no import of any of them.
 */
export function isUpstreamOutage(error: unknown): boolean {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? error.status
      : undefined;
  return typeof status === "number" && upstreamOutageStatuses.has(status);
}

/** The app-wide TanStack Query `retry`: once, except for an upstream outage. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return failureCount < 1 && !isUpstreamOutage(error);
}
