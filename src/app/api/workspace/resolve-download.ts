import { NextResponse } from "next/server";
import { readAuthSession } from "@/lib/auth/server/route";
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

  const wsResponse = await fetch(getRequiredEnv("WORKSPACE_API_URL"), {
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
  });

  if (!wsResponse.ok) {
    const responseText = await wsResponse.text();
    console.error(
      "BV-BRC API error:",
      wsResponse.status,
      wsResponse.statusText,
      responseText,
    );
    return NextResponse.json(
      {
        error: `BV-BRC API error: ${String(wsResponse.status)} ${wsResponse.statusText}`,
      },
      { status: wsResponse.status },
    );
  }

  const data = (await wsResponse.json()) as { result?: [[string]] } | null;
  const downloadUrl = data?.result?.[0]?.[0];

  if (!downloadUrl) {
    return NextResponse.json(
      { error: "Download URL not found for the requested path" },
      { status: 404 },
    );
  }

  const shockResponse = await fetch(downloadUrl);

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
