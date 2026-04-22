import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { JsonRpcError, jsonRpcErrorCodes } from "@/lib/jsonrpc-client";
import type { AuthErrorCode } from "@/lib/auth/port";
import { statusToErrorCode } from "@/lib/api/types";
import type { ApiErrorCode } from "@/lib/api/types";

export interface AuthErrorInit {
  status?: number;
  details?: unknown;
}

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly status?: number;
  readonly details?: unknown;

  constructor(code: AuthErrorCode, message: string, init: AuthErrorInit = {}) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.status = init.status;
    this.details = init.details;
  }
}

export function statusFor(error: {
  code: AuthErrorCode;
  status?: number;
}): number {
  if (error.status) return error.status;
  switch (error.code) {
    case "invalid_credentials":
    case "unauthorized":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "conflict":
      return 409;
    case "validation":
      return 400;
    case "service_unavailable":
      return 503;
    case "network":
      return 502;
    default:
      return 500;
  }
}

function rpcCodeToHttpStatus(rpcCode: number, fallback: number): number {
  switch (rpcCode) {
    case jsonRpcErrorCodes.UNAUTHORIZED:
      return 401;
    case jsonRpcErrorCodes.FORBIDDEN:
      return 403;
    case jsonRpcErrorCodes.NOT_FOUND:
      return 404;
    case jsonRpcErrorCodes.VALIDATION_ERROR:
    case jsonRpcErrorCodes.INVALID_PARAMS:
      return 400;
    default:
      return fallback;
  }
}

export function errorResponse(
  error: unknown,
  fallbackStatus = 500,
): NextResponse {
  if (error instanceof AuthError) {
    const status = statusFor(error);
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details,
      },
      { status },
    );
  }

  if (error instanceof JsonRpcError) {
    const status = rpcCodeToHttpStatus(error.code, fallbackStatus);
    return NextResponse.json(
      {
        error: error.message,
        code: statusToErrorCode(status),
        details: error.data,
      },
      { status },
    );
  }

  if (error instanceof Error) {
    return NextResponse.json(
      { error: error.message, code: "upstream" as ApiErrorCode },
      { status: fallbackStatus },
    );
  }

  return NextResponse.json(
    { error: "Internal server error", code: "unknown" as ApiErrorCode },
    { status: fallbackStatus },
  );
}

export async function toResponse(
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    console.error("Route handler error:", error);
    return errorResponse(error);
  }
}

export function withErrorHandling<TCtx = object>(
  handler: (req: NextRequest, ctx: TCtx) => Promise<NextResponse>,
): (req: NextRequest, ctx: TCtx) => Promise<NextResponse> {
  return (req: NextRequest, ctx: TCtx) =>
    toResponse(() => handler(req, ctx));
}
