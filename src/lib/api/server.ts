import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth/session";
import { JsonRpcError } from "@/lib/jsonrpc-client";
import type { ApiErrorCode } from "./types";

export function errorResponse(
  error: unknown,
  fallbackStatus = 500,
): NextResponse {
  if (error instanceof JsonRpcError) {
    return NextResponse.json(
      { error: error.message, code: "upstream" as ApiErrorCode },
      { status: fallbackStatus },
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

type AuthedHandler<TContext> = (
  request: NextRequest,
  context: TContext & { token: string },
) => Promise<NextResponse>;

export function withAuth<TContext = object>(
  handler: AuthedHandler<TContext>,
): (request: NextRequest, context: TContext) => Promise<NextResponse> {
  return async (request: NextRequest, context: TContext) => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return NextResponse.json(
          { error: "Authentication required", code: "unauthenticated" },
          { status: 401 },
        );
      }
      return await handler(request, { ...context, token });
    } catch (error) {
      console.error("Route handler error:", error);
      return errorResponse(error);
    }
  };
}

type OptionalAuthHandler<TContext> = (
  request: NextRequest,
  context: TContext & { token: string | undefined },
) => Promise<NextResponse>;

export function withOptionalAuth<TContext = object>(
  handler: OptionalAuthHandler<TContext>,
): (request: NextRequest, context: TContext) => Promise<NextResponse> {
  return async (request: NextRequest, context: TContext) => {
    try {
      const token = await getAuthToken();
      return await handler(request, { ...context, token });
    } catch (error) {
      console.error("Route handler error:", error);
      return errorResponse(error);
    }
  };
}
