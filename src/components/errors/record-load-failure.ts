import {
  describeUpstreamFailure,
  upstreamServices,
  upstreamTimeoutMs,
} from "@/lib/api/upstream-failure";
import { isUpstreamOutageError } from "@/lib/api/upstream-outage";
import { DataApiError } from "@/lib/data-api/repository";
import { formatUserFacingErrorMessage } from "@/lib/utils";

export const recordUnavailableFallback =
  "The data service did not respond. This is usually temporary; please try again.";

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
  if (!isUpstreamOutageError(error, service)) return null;
  if (error instanceof DataApiError) {
    return formatUserFacingErrorMessage(error, fallback);
  }
  const failure = describeUpstreamFailure(error, service, { timeoutMs });
  if (!failure) return null;
  return formatUserFacingErrorMessage(new Error(failure.message), fallback);
}

export function recordUnavailableMessage(error: unknown): string | null {
  return upstreamOutageMessage(error, upstreamServices.dataApi, {
    fallback: recordUnavailableFallback,
    timeoutMs: upstreamTimeoutMs.dataApi,
  });
}
