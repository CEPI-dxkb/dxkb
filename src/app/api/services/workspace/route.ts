import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth/session";
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
export async function POST(request: NextRequest) {
  try {
    // Get the BV-BRC auth token from cookies
    const authToken = await getAuthToken();

    if (!authToken) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Get the request body
    const body = await request.json();
    const { method, params } = body;

    // Validate required fields
    if (!method) {
      return NextResponse.json(
        { error: "method is required" },
        { status: 400 },
      );
    }

    // Make the request to BV-BRC Workspace API
    const response = await fetch(getRequiredEnv("WORKSPACE_API_URL"), {
      method: "POST",
      headers: {
        "Content-Type": "application/jsonrpc+json",
        "Authorization": authToken,
      },
      body: JSON.stringify({
        id: 1,
        method,
        params,
        jsonrpc: "2.0",
      }),
    });

    if (!response.ok) {
      // Missing preferences path is expected when .preferences or favorites.json does not exist.
      // Only treat 404 as "not found" so the client can create the file/dir. Do not treat 500 as not
      // found — 500 indicates upstream server/database failures; those must be logged and propagated.
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
}

