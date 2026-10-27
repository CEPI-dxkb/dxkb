import {
  describeUpstreamFailure,
  upstreamServices,
  upstreamTimeoutMs,
} from "@/lib/api/upstream-failure";
import { DataApiError } from "@/lib/data-api/repository";
import { formatUserFacingErrorMessage } from "@/lib/utils";

/** Used only when a failure carries no message of its own. */
export const recordUnavailableFallback =
  "The data service did not respond. This is usually temporary; please try again.";

// Server misconfiguration, not an outage: the message names an env var, so it
// stays on the server (thrown, logged, redacted in production).
const configurationErrorCodes = new Set(["not_configured", "insecure_upstream"]);

interface UpstreamOutageOptions {
  /** Used only when the failure carries no message of its own. */
  fallback: string;
  /** The budget a raw `TimeoutError` spent, for its message. */
  timeoutMs?: number;
}

/**
 * The condensed reason a server page shows when a load failed because a
 * backend is down, or `null` when the error is not an outage:
 *
 * - a `DataApiError` with status >= 500 (configuration codes excluded);
 * - an `UpstreamError` with status >= 500;
 * - a raw network failure (refused, unreachable, timed out), described by
 *   `describeUpstreamFailure` naming `service`, since undici's own message is
 *   only "fetch failed".
 *
 * Anything else (a missing env var, a parse error, a bug) is `null` for the
 * caller to rethrow, so it reaches the `error.tsx` boundary and the server log
 * instead of the page: its message can name server configuration.
 *
 * A server page has to render this message rather than throw it, because
 * production replaces a thrown server error's message with a digest.
 */
export function upstreamOutageMessage(
  error: unknown,
  service: string,
  { fallback, timeoutMs }: UpstreamOutageOptions,
): string | null {
  if (error instanceof DataApiError) {
    if (error.status < 500 || configurationErrorCodes.has(error.code)) {
      return null;
    }
    return formatUserFacingErrorMessage(error, fallback);
  }
  const failure = describeUpstreamFailure(error, service, { timeoutMs });
  if (!failure || failure.status < 500) return null;
  return formatUserFacingErrorMessage(new Error(failure.message), fallback);
}

/**
 * `upstreamOutageMessage` for a record page's Data API lookup. `null` keeps
 * the loader's own handling: 401/403/404 stay not-found, and a bug still
 * reaches the `error.tsx` boundary.
 */
export function recordUnavailableMessage(error: unknown): string | null {
  return upstreamOutageMessage(error, upstreamServices.dataApi, {
    fallback: recordUnavailableFallback,
    timeoutMs: upstreamTimeoutMs.dataApi,
  });
}
