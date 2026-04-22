import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { getRequiredEnv } from "@/lib/env";

/** Safe shape we forward to the client; avoids leaking stack traces, paths, or config. */
interface SanitizedApiError {
  code?: number;
  message?: string;
}

function sanitizeUpstreamError(raw: unknown): SanitizedApiError | null {
  if (raw == null) return null;
  const obj = typeof raw === "object" && raw !== null ? raw : null;
  if (!obj) return null;
  const code =
    typeof (obj as { error?: { code?: unknown } }).error === "object" &&
    (obj as { error: { code?: unknown } }).error !== null
      ? (obj as { error: { code?: unknown } }).error.code
      : (obj as { code?: unknown }).code;
  const message =
    typeof (obj as { error?: { message?: unknown } }).error === "object" &&
    (obj as { error: { message?: unknown } }).error !== null
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
export const POST = auth.route(async (request: NextRequest, { token }) => {
  try {
    const body = await request.json();
    const { method, params } = body;

    if (!method) {
      return NextResponse.json(
        { error: "method is required" },
        { status: 400 },
      );
    }

    const response = await fetch(getRequiredEnv("WORKSPACE_API_URL"), {
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
    });

    if (!response.ok) {
      const isPreferencesGet =
        method === "Workspace.get" &&
        Array.isArray(params) &&
        (params[0] as { objects?: unknown[] })?.objects?.some?.((path: unknown) => {
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
      console.error("BV-BRC API error:", response.status, response.statusText, apiResponse);
      const sanitized = sanitizeUpstreamError(apiResponse);
      return NextResponse.json(
        {
          error: `BV-BRC API error: ${response.status} ${response.statusText}`,
          ...(sanitized && { apiResponse: sanitized }),
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Workspace API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
});
