import { NextResponse } from "next/server";
import { readAuthSession } from "@/lib/auth/server/route";
import {
  describeUpstreamFailure,
  describeUpstreamResponse,
  fetchUpstream,
  hostOf,
  UpstreamError,
  upstreamServices,
  upstreamTimeoutMs,
} from "@/lib/api/upstream-failure";
import { statusToErrorCode } from "@/lib/api/types";
import { isWorkspaceObjectMissing } from "@/lib/services/workspace/workspace-errors";
import { getRequiredEnv } from "@/lib/env";
import { getMimeType } from "@/components/workspace/file-viewer/file-viewer-registry";

/**
 * Build a safe Content-Disposition header value.
 * Produces an ASCII-safe `filename=` parameter and, when the name contains
 * non-ASCII characters, an RFC 6266 `filename*=UTF-8''...` extended parameter.
 */
export function contentDisposition(
  disposition: "inline" | "attachment",
  filename: string,
): string {
  const asciiFallback = filename
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_");
  const base = `${disposition}; filename="${asciiFallback}"`;

  if (asciiFallback !== filename) {
    const encoded = encodeURIComponent(filename).replace(/'/g, "%27");
    return `${base}; filename*=UTF-8''${encoded}`;
  }

  return base;
}

/**
 * The response sandbox for a workspace file. Its bytes are whatever a user
 * uploaded, and a readable file may be someone else's (shared and public
 * folders), so a document rendered from it must never run as the app:
 * `sandbox` without `allow-same-origin` gives it an opaque origin, which
 * cannot read app responses or storage and whose requests are cross-site,
 * so the `SameSite=Strict` session cookie stays home.
 * - HTML keeps `allow-scripts` (job reports are interactive, as in the
 *   preview iframe) and `allow-popups` (report links that open a tab;
 *   a popup inherits the sandbox).
 * - PDF gets none: Chrome's PDF viewer will not render under any sandbox,
 *   and PDF script runs in the viewer, not the page origin.
 * - Everything else gets a bare `sandbox`: SVG and XML can carry script,
 *   and nothing else needs it.
 */
export function workspaceFileSandbox(contentType: string): string | null {
  if (contentType === "application/pdf") return null;
  if (contentType === "text/html") return "sandbox allow-scripts allow-popups";
  return "sandbox";
}

/**
 * Content headers for a workspace file served under the app origin. Every
 * route that answers with a file's bytes uses these, so none can forget the
 * sandbox. `nosniff` holds the browser to the extension-derived type.
 */
export function workspaceFileHeaders(
  filename: string,
  contentType: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Disposition": contentDisposition("inline", filename),
    "X-Content-Type-Options": "nosniff",
  };
  const sandbox = workspaceFileSandbox(contentType);
  if (sandbox) headers["Content-Security-Policy"] = sandbox;
  return headers;
}

export interface ResolvedDownload {
  shockResponse: Response;
  filename: string;
  contentType: string;
}

/**
 * `segments` come from a catch-all ROUTE HANDLER's `params.path`. Route
 * handlers never go through `getDynamicParam()`, so they receive the route
 * matcher's already-decoded segments — do not decode again here, or a
 * literal `%2F` in a file name becomes a real `/`, splitting one segment
 * into two and resolving a different (nonexistent) workspace path.
 *
 * This is NOT true of a page component's params, which arrive re-encoded.
 * Do not copy this comment onto one — see `readRouteParam` in
 * `src/lib/views/route-params.ts`.
 */
export function buildWorkspacePath(segments: string[]): string {
  return "/" + segments.join("/");
}

/**
 * Resolve a workspace file path to a Shock download response.
 *
 * Returns either a `ResolvedDownload` on success, or a `NextResponse` error
 * that the caller should return directly.
 */
/** The `error.message` of a JSON-RPC envelope, or null for any other body. */
function jsonRpcErrorMessage(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown } };
    const message = parsed.error?.message;
    return typeof message === "string" && message.trim()
      ? message.replace(/^_ERROR_|_ERROR_$|(?<=!)_$/g, "").trim()
      : null;
  } catch {
    return null;
  }
}

export async function resolveWorkspaceDownload(
  segments: string[],
): Promise<ResolvedDownload | NextResponse> {
  const session = await readAuthSession();
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required", code: "session_expired" },
      { status: 401 },
    );
  }

  const workspacePath = buildWorkspacePath(segments);

  const wsResponse = await fetchUpstream(
    getRequiredEnv("WORKSPACE_API_URL"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/jsonrpc+json",
        Authorization: session.token,
      },
      body: JSON.stringify({
        id: 1,
        method: "Workspace.get_download_url",
        params: [{ objects: [workspacePath] }],
        jsonrpc: "2.0",
      }),
    },
    {
      service: upstreamServices.workspace,
      timeoutMs: upstreamTimeoutMs.workspace,
    },
  );

  // The budget also bounds the Workspace's body. A budget spent (or a socket
  // dropped) mid-body is the Workspace's failure, described here: the routes'
  // catch-alls would otherwise blame file storage for it.
  const bodyFailure = (error: unknown): never => {
    const failure = describeUpstreamFailure(error, upstreamServices.workspace, {
      timeoutMs: upstreamTimeoutMs.workspace,
      host: hostOf(wsResponse.url),
    });
    throw failure ? new UpstreamError(failure, { cause: error }) : error;
  };

  if (!wsResponse.ok) {
    const responseText = await wsResponse.text().catch(bodyFailure);
    console.error(
      `BV-BRC API error from ${hostOf(wsResponse.url) ?? "the workspace"}:`,
      wsResponse.status,
      wsResponse.statusText,
      responseText,
    );
    // The Workspace reports its own errors ("_ERROR_Object not found!_") as a
    // JSON-RPC error inside an HTTP 500: pass that message on, as a 404 when
    // the object is missing, so the viewer can say what went wrong.
    const rpcMessage = jsonRpcErrorMessage(responseText);
    if (rpcMessage) {
      const status = isWorkspaceObjectMissing(new Error(rpcMessage))
        ? 404
        : wsResponse.status;
      return NextResponse.json(
        { error: rpcMessage, code: statusToErrorCode(status) },
        { status },
      );
    }
    const failure = describeUpstreamResponse(
      wsResponse,
      responseText,
      upstreamServices.workspace,
    );
    return NextResponse.json(
      { error: failure.message, code: statusToErrorCode(failure.status) },
      { status: failure.status },
    );
  }

  const data = (await wsResponse.json().catch(bodyFailure)) as {
    result?: [[string]];
  } | null;
  const downloadUrl = data?.result?.[0]?.[0];

  if (!downloadUrl) {
    return NextResponse.json(
      { error: "Download URL not found for the requested path" },
      { status: 404 },
    );
  }

  // Only the wait for Shock to start answering is bounded: the file itself
  // streams through to the browser and may take as long as it takes.
  const shockResponse = await fetchUpstream(
    downloadUrl,
    {},
    {
      service: upstreamServices.fileStorage,
      timeoutMs: upstreamTimeoutMs.fileStorage,
      streamBody: true,
    },
  );

  if (!shockResponse.ok) {
    console.error(
      "Shock download error:",
      shockResponse.status,
      shockResponse.statusText,
    );
    return NextResponse.json(
      { error: "Failed to fetch file content from storage" },
      { status: 502 },
    );
  }

  const filename = segments[segments.length - 1] ?? "download";
  const contentType = getMimeType(filename);

  return { shockResponse, filename, contentType };
}
