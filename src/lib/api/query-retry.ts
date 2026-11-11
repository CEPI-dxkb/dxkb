/** Statuses a route answers when an upstream is down; retrying one at once only doubles the wait. */
const upstreamOutageStatuses = new Set([502, 503, 504]);

/** Whether a query error is an upstream outage, read from the `status` every client error type carries. */
export function isUpstreamOutage(error: unknown): boolean {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? error.status
      : undefined;
  return typeof status === "number" && upstreamOutageStatuses.has(status);
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return failureCount < 1 && !isUpstreamOutage(error);
}
