import "server-only";

import {
  describeUpstreamFailure,
  upstreamCauseCode,
} from "@/lib/api/upstream-failure";
import { DataApiError } from "@/lib/data-api/repository";

// Server misconfiguration, not an outage: the message names an env var, so it
// stays on the server.
const configurationErrorCodes = new Set(["not_configured", "insecure_upstream"]);

// A connection the peer dropped can be one stale keep-alive socket on a
// healthy host.
const droppedConnectionCodes = new Set([
  "ECONNRESET",
  "EPIPE",
  "UND_ERR_SOCKET",
  "UND_ERR_CLOSED",
]);

function outageFailure(
  error: unknown,
  service: string,
): { status: number; code: string } | null {
  if (error instanceof DataApiError) {
    return error.status >= 500 && !configurationErrorCodes.has(error.code)
      ? error
      : null;
  }
  const failure = describeUpstreamFailure(error, service);
  return failure && failure.status >= 500 ? failure : null;
}

/**
 * A backend failure (5xx, timeout, unreachable host) rather than a 4xx, a
 * configuration error or a bug; `service` names the backend in the message
 * `describeUpstreamFailure` builds for a raw network error.
 */
export function isUpstreamOutageError(error: unknown, service: string): boolean {
  return outageFailure(error, service) !== null;
}

function isDroppedConnection(error: unknown): boolean {
  // A DataApiError's own `code` is ours, not the socket's.
  let cause: unknown = error;
  while (cause instanceof DataApiError) cause = cause.cause;
  const code = upstreamCauseCode(cause);
  return code !== undefined && droppedConnectionCodes.has(code);
}

export interface UpstreamLoadTiming {
  elapsedMs: number;
  /** The fetch budget the load ran under. */
  budgetMs: number;
}

/**
 * An outage that says the host itself is down: a timeout, a 503 or an
 * unreachable host, but not a dropped connection. With `timing`, also any
 * outage that took at least half the budget, since a host that slow is
 * struggling; a fast 5xx or `malformed_response` can come from one bad query
 * while the service is healthy, so it does not count.
 */
export function isUpstreamDown(
  error: unknown,
  service: string,
  timing?: UpstreamLoadTiming,
): boolean {
  const failure = outageFailure(error, service);
  if (failure === null) return false;
  if (timing && timing.elapsedMs >= timing.budgetMs / 2) return true;
  const hostDown =
    failure.status === 503 ||
    failure.status === 504 ||
    failure.code === "service_unavailable";
  return hostDown && !isDroppedConnection(error);
}
