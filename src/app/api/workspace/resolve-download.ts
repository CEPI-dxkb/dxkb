import { NextResponse } from "next/server";
import { requireAuthToken } from "@/lib/auth/session";
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
  // ASCII-safe fallback: strip characters that break the quoted-string
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  const base = `${disposition}; filename="${asciiFallback}"`;

  // If the original name differs, add the extended parameter for full Unicode support
  if (asciiFallback !== filename) {
    const encoded = encodeURIComponent(filename).replace(/'/g, "%27");
    return `${base}; filename*=UTF-8''${encoded}`;
  }

  return base;
}

/**
 * Shared result from resolving a workspace path to a Shock download stream.
 */
export interface ResolvedDownload {
  shockResponse: Response;
  filename: string;
  contentType: string;
}

/**
 * Decode route path segments into a workspace path string.
 */
export function buildWorkspacePath(segments: string[]): string {
  return "/" + segments.map((s) => decodeURIComponent(s)).join("/");
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
  const authToken = await requireAuthToken();
  if (authToken instanceof NextResponse) return authToken;

  const workspacePath = buildWorkspacePath(segments);

  const wsResponse = await fetch(getRequiredEnv("WORKSPACE_API_URL"), {
    method: "POST",
    headers: {
      "Content-Type": "application/jsonrpc+json",
      Authorization: authToken,
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
        error: `BV-BRC API error: ${wsResponse.status} ${wsResponse.statusText}`,
      },
      { status: wsResponse.status },
    );
  }

  const data = await wsResponse.json();
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

  const lastSegment = segments[segments.length - 1] ?? "download";
  const filename = decodeURIComponent(lastSegment);
  const contentType = getMimeType(filename);

  return { shockResponse, filename, contentType };
}
