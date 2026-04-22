import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth/session";
import { errorResponse } from "@/lib/auth/server/errors";

export { errorResponse };

async function safeHandle(
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    console.error("Route handler error:", error);
    return errorResponse(error);
  }
}

type AuthedHandler<TContext> = (
  request: NextRequest,
  context: TContext & { token: string },
) => Promise<NextResponse>;

export function withAuth<TContext = object>(
  handler: AuthedHandler<TContext>,
): (request: NextRequest, context: TContext) => Promise<NextResponse> {
  return (request: NextRequest, context: TContext) =>
    safeHandle(async () => {
      const token = await getAuthToken();
      if (!token) {
        return NextResponse.json(
          { error: "Authentication required", code: "unauthenticated" },
          { status: 401 },
        );
      }
      return handler(request, { ...context, token });
    });
}

type OptionalAuthHandler<TContext> = (
  request: NextRequest,
  context: TContext & { token: string | undefined },
) => Promise<NextResponse>;

export function withOptionalAuth<TContext = object>(
  handler: OptionalAuthHandler<TContext>,
): (request: NextRequest, context: TContext) => Promise<NextResponse> {
  return (request: NextRequest, context: TContext) =>
    safeHandle(async () => {
      const token = await getAuthToken();
      return handler(request, { ...context, token });
    });
}

type PlainHandler<TContext> = (
  request: NextRequest,
  context: TContext,
) => Promise<NextResponse>;

export function withErrorHandling<TContext = object>(
  handler: PlainHandler<TContext>,
): (request: NextRequest, context: TContext) => Promise<NextResponse> {
  return (request: NextRequest, context: TContext) =>
    safeHandle(() => handler(request, context));
}
