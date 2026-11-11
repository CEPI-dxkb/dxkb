import { NextResponse } from "next/server";

import {
  describeUpstreamResponse,
  hostOf,
  upstreamServices,
} from "./upstream-failure";

/** Safe shape forwarded to the client; no stack traces, paths or config. */
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
 * The answer a Workspace JSON-RPC proxy route gives for a non-OK Workspace response.
 * The body is read without a catch so a stalled body rejects into the route's catch-all (`upstreamFailureResponse`) as 504/502.
 */
export async function workspaceErrorReply(
  response: Response,
  logLabel: string,
): Promise<NextResponse> {
  const responseText = await response.text();
  let apiResponse: unknown = null;
  try {
    apiResponse = responseText ? JSON.parse(responseText) : null;
  } catch {
    apiResponse = responseText || null;
  }
  console.error(
    `${logLabel} from ${hostOf(response.url) ?? "the workspace"}:`,
    response.status,
    response.statusText,
    apiResponse,
  );
  const sanitized = sanitizeUpstreamError(apiResponse);
  // A Workspace JSON-RPC error keeps the "BV-BRC API error: <status>" label with its message in `apiResponse` (read by `workspace-errors.ts`); any other body is described by status and page title, never forwarded.
  const error = sanitized?.message
    ? `BV-BRC API error: ${String(response.status)} ${response.statusText}`
    : describeUpstreamResponse(response, responseText, upstreamServices.workspace)
        .message;
  return NextResponse.json(
    {
      error,
      ...(sanitized && { apiResponse: sanitized }),
    },
    { status: response.status },
  );
}
