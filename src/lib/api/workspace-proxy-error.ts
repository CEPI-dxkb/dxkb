import { NextResponse } from "next/server";

import {
  describeUpstreamResponse,
  hostOf,
  upstreamServices,
} from "./upstream-failure";

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
 * The answer a Workspace JSON-RPC proxy route (`/api/services/workspace`,
 * `/api/workspace/public`) gives for a non-OK Workspace response, with the
 * upstream status. `logLabel` starts the server log line, which names the
 * host.
 *
 * The body is read without a catch: a body that stalls or resets rejects, so
 * a route `return await`s this inside its `try`, and its catch-all
 * (`upstreamFailureResponse`) answers the rejection 504/502.
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
  // A Workspace JSON-RPC error keeps the "BV-BRC API error: <status>"
  // label, with the Workspace's own message in `apiResponse` (which
  // `workspace-errors.ts` reads). Any other body (a maintenance page) is
  // described by its status and page title, never forwarded.
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
