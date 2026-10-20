import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/server/route";
import {
  describeUpstreamResponse,
  fetchUpstream,
  hostOf,
  upstreamServices,
  upstreamTimeoutMs,
} from "@/lib/api/upstream-failure";
import { upstreamFailureResponse } from "@/lib/api/upstream-route";
import { getRequiredEnv } from "@/lib/env";

/** Safe shape we forward to the client; avoids leaking stack traces, paths, or config. */
interface SanitizedApiError {
  code?: number;
  message?: string;
}

function sanitizeUpstreamError(raw: unknown): SanitizedApiError | null {
  if (raw == null) return null;
  const obj = typeof raw === "object" ? raw : null;
  if (!obj) return null;
  const code =
    typeof (obj as { error?: { code?: unknown } }).error === "object" &&
    (obj as { error?: { code?: unknown } }).error != null
      ? (obj as { error: { code?: unknown } }).error.code
      : (obj as { code?: unknown }).code;
  const message =
    typeof (obj as { error?: { message?: unknown } }).error === "object" &&
    (obj as { error?: { message?: unknown } }).error != null
      ? (obj as { error: { message?: unknown } }).error.message
      : (obj as { message?: unknown }).message;
  const sanitized: SanitizedApiError = {};
  if (typeof code === "number" && Number.isFinite(code))
    sanitized.code = code;
  if (typeof message === "string") sanitized.message = message;
  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

/**
 * Workspace API proxy route
 * Forwards JSON-RPC requests to WORKSPACE_API_URL
 */
export const POST = withAuth(async (request: NextRequest, { token }) => {
  try {
    const body = (await request.json()) as { method?: unknown; params?: unknown };
    const { method, params } = body;

    if (!method) {
      return NextResponse.json(
        { error: "method is required" },
        { status: 400 },
      );
    }

    const response = await fetchUpstream(
      getRequiredEnv("WORKSPACE_API_URL"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/jsonrpc+json",
          Authorization: token,
        },
        body: JSON.stringify({
          id: 1,
          method,
          params,
          jsonrpc: "2.0",
        }),
      },
      {
        service: upstreamServices.workspace,
        timeoutMs: upstreamTimeoutMs.workspace,
      },
    );

    if (!response.ok) {
      const firstParam: unknown = Array.isArray(params) ? params[0] : undefined;
      const isPreferencesGet =
        method === "Workspace.get" &&
        typeof firstParam === "object" &&
        firstParam !== null &&
        (firstParam as { objects?: unknown[] }).objects?.some((path: unknown) => {
          if (typeof path !== "string") return false;
          return (
            path.endsWith("/home/.preferences/favorites.json") ||
            path.endsWith("/home/.preferences")
          );
        });
      if (isPreferencesGet && response.status === 404) {
        return NextResponse.json({
          id: 1,
          result: [],
          jsonrpc: "2.0",
        });
      }

      const responseText = await response.text();
      let apiResponse: unknown = null;
      try {
        apiResponse = responseText ? JSON.parse(responseText) : null;
      } catch {
        apiResponse = responseText || null;
      }
      console.error(
        `BV-BRC API error from ${hostOf(response.url) ?? "the workspace"}:`,
        response.status,
        response.statusText,
        apiResponse,
      );
      const sanitized = sanitizeUpstreamError(apiResponse);
      // A Workspace JSON-RPC error keeps the "BV-BRC API error: <status>"
      // label, with the Workspace's own message in `apiResponse` (which
      // `workspace-errors.ts` reads). Any other body (a maintenance page) is
      // described by its status and page title, never forwarded.
      const error = sanitized?.message
        ? `BV-BRC API error: ${String(response.status)} ${response.statusText}`
        : describeUpstreamResponse(
            response,
            responseText,
            upstreamServices.workspace,
          ).message;
      return NextResponse.json(
        {
          error,
          ...(sanitized && { apiResponse: sanitized }),
        },
        { status: response.status },
      );
    }

    const data: unknown = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Workspace API error:", error);
    return upstreamFailureResponse(error, upstreamServices.workspace);
  }
});
