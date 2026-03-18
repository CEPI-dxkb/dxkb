import { NextRequest, NextResponse } from "next/server";
import { getBvbrcAuthToken } from "@/lib/auth";
import { createAppService, type AppService } from "@/lib/app-service";
import { JsonRpcError } from "@/lib/jsonrpc-client";
import { ApiError } from "./api-error";

export interface RouteContext {
  token: string;
  appService: AppService;
  request: NextRequest;
  params: Record<string, string>;
  searchParams: URLSearchParams;
}

interface ProtectedRouteOptions {
  /** Set to false to skip auth check (default: true) */
  requireAuth?: boolean;
  /** Custom response formatter — return a NextResponse to bypass default JSON serialization */
  formatResponse?: (result: unknown) => NextResponse;
}

type NextRouteHandler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) => Promise<NextResponse>;

/**
 * Wraps an API route handler with auth check, AppService creation, and error handling.
 *
 * The handler receives a RouteContext and returns data that is auto-serialized
 * to NextResponse.json(). Return a NextResponse directly to bypass serialization.
 */
export function protectedRoute<T>(
  handler: (ctx: RouteContext) => Promise<T>,
  options: ProtectedRouteOptions = {},
): NextRouteHandler {
  const { requireAuth = true, formatResponse } = options;

  return async (request, context) => {
    try {
      const token = await getBvbrcAuthToken();

      if (requireAuth && !token) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        );
      }

      const params = context?.params ? await context.params : {};
      const searchParams = new URL(request.url).searchParams;

      // Lazy AppService — only created when the handler accesses it, so routes
      // that only need `token` don't pay for the getRequiredEnv("APP_SERVICE_URL") call.
      let _appService: AppService | undefined;
      const ctx: RouteContext = {
        token: token ?? "",
        get appService() {
          if (!_appService) _appService = createAppService(token ?? "");
          return _appService;
        },
        request,
        params,
        searchParams,
      };

      const result = await handler(ctx);

      // If the handler already returned a NextResponse, pass it through
      if (result instanceof NextResponse) {
        return result;
      }

      if (formatResponse) {
        return formatResponse(result);
      }

      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof ApiError) {
        const body =
          typeof error.body === "string" ? { error: error.body } : error.body;
        return NextResponse.json(body, { status: error.status });
      }

      if (error instanceof JsonRpcError) {
        return NextResponse.json(
          { error: error.message, code: error.code, data: error.data },
          { status: 500 },
        );
      }

      console.error("Route handler error:", error);

      if (error instanceof Error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  };
}
