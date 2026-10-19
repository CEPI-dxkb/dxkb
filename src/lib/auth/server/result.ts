import { describeUpstreamFailure } from "@/lib/api/upstream-failure";
import type { AuthError, AuthErrorCode, Result } from "@/lib/auth/types";

export function ok<T>(data: T): Result<T> {
  return { data, error: null };
}

export function fail<T>(
  code: AuthErrorCode,
  message: string,
  status?: number,
): Result<T> {
  return { data: null, error: { code, message, status } };
}

/**
 * A request that never got an answer. `service` names who did not answer
 * ("the BV-BRC authentication service"); the message keeps the cause
 * ("Could not reach … (user.bv-brc.org): connection refused.").
 */
export function networkFailure(
  cause: unknown,
  service: string,
  host?: string,
): AuthError {
  const failure = describeUpstreamFailure(cause, service, { host });
  return {
    message:
      failure?.message ??
      `Could not reach ${service}${host ? ` (${host})` : ""}${cause instanceof Error && cause.message ? `: ${cause.message}` : ""}.`,
    // An undici connect timeout is a timeout, like the request budget's own.
    code: failure?.code === "upstream_timeout" ? "service_unavailable" : "network",
    status: failure?.status ?? 502,
  };
}
