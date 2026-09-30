import { NextResponse } from "next/server";
import type {
  AuthError,
  AuthSessionMutation,
  AuthUser,
  Result,
} from "@/lib/auth/types";
import { statusToErrorCode } from "@/lib/api/types";
import { statusFor } from "./errors";
import { clearCurrentSession } from "./session";

export interface SessionEnvelope {
  user: AuthUser | null;
  session: { token: ""; expiresAt: string } | null;
}

export function buildEnvelope(
  user: AuthUser | null,
  expiresAt?: number,
): SessionEnvelope {
  if (user && expiresAt === undefined) {
    throw new Error("expiresAt is required for a session response");
  }
  return {
    user,
    session: user
      ? { token: "", expiresAt: new Date(expiresAt as number).toISOString() }
      : null,
  };
}

function errorResponse(error: AuthError, sessionExpired = false): NextResponse {
  const status = statusFor(error);
  return NextResponse.json(
    {
      error: error.message,
      code: sessionExpired ? "session_expired" : statusToErrorCode(status),
    },
    { status },
  );
}

export function respondWithSession(
  result: Result<AuthUser | null>,
  expiresAt?: number,
  options?: { sessionExpired?: boolean },
): NextResponse {
  return result.error
    ? errorResponse(result.error, options?.sessionExpired)
    : NextResponse.json(buildEnvelope(result.data, expiresAt));
}

export function respondWithSessionMutation(
  result: Result<AuthSessionMutation>,
  options?: { sessionExpired?: boolean },
): NextResponse {
  return result.error
    ? respondWithSession(result, undefined, options)
    : respondWithSession(
        { data: result.data.user, error: null },
        result.data.expiresAt,
      );
}

export function respondWithAck(
  result: Result<void>,
  options?: { sessionExpired?: boolean },
): NextResponse {
  return result.error
    ? errorResponse(result.error, options?.sessionExpired)
    : NextResponse.json({ success: true });
}

/**
 * The error envelope for a failed upstream call a route makes with the session
 * token itself, rather than through a named action (the profile proxy). An
 * `unauthorized` failure means the upstream rejected that token, so the session is
 * cleared and the code is `session_expired`, as the actions and `respondWithAck`'s
 * `sessionExpired` option do together for the other routes.
 */
export async function respondWithUpstreamFailure(
  error: AuthError,
): Promise<NextResponse> {
  const sessionExpired = error.code === "unauthorized";
  if (sessionExpired) await clearCurrentSession();
  return errorResponse(error, sessionExpired);
}
