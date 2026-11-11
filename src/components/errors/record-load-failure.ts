import {
  describeUpstreamFailure,
  upstreamServices,
  upstreamTimeoutMs,
} from "@/lib/api/upstream-failure";
import { DataApiError } from "@/lib/data-api/repository";
import { formatUserFacingErrorMessage } from "@/lib/utils";

export const recordUnavailableFallback =
  "The data service did not respond. This is usually temporary; please try again.";

// Server misconfiguration, not an outage: the message names an env var, so it
// stays on the server.
const configurationErrorCodes = new Set(["not_configured", "insecure_upstream"]);

interface UpstreamOutageOptions {
  fallback: string;
  timeoutMs?: number;
}

/**
 * The condensed reason when a backend is down, or `null` for anything else
 * (config errors, bugs) so the caller rethrows it to `error.tsx`.
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

export function recordUnavailableMessage(error: unknown): string | null {
  return upstreamOutageMessage(error, upstreamServices.dataApi, {
    fallback: recordUnavailableFallback,
    timeoutMs: upstreamTimeoutMs.dataApi,
  });
}
