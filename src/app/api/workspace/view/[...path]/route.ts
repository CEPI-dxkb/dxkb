import { NextRequest, NextResponse } from "next/server";
import { requireAuthToken } from "@/lib/auth/session";
import { getRequiredEnv } from "@/lib/env";

const mimeMap: Record<string, string> = {
  ".txt": "text/plain",
  ".log": "text/plain",
  ".fa": "text/plain",
  ".fasta": "text/plain",
  ".faa": "text/plain",
  ".fna": "text/plain",
  ".gff": "text/plain",
  ".xmfa": "text/plain",
  ".vcf": "text/plain",
  ".nwk": "text/plain",
  ".afa": "text/plain",
  ".gfa": "text/plain",
  ".json": "application/json",
  ".csv": "text/csv",
  ".tsv": "text/tab-separated-values",
  ".html": "text/html",
  ".htm": "text/html",
  ".pdf": "application/pdf",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".xml": "text/xml",
  ".pdb": "chemical/x-pdb",
};

function getMimeType(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1) return "application/octet-stream";
  const ext = filename.substring(dotIndex).toLowerCase();
  return mimeMap[ext] ?? "application/octet-stream";
}

/**
 * Workspace file content proxy route.
 * Resolves a workspace path to a Shock download URL, then streams the file content back.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  try {
    const authToken = await requireAuthToken();
    if (authToken instanceof NextResponse) return authToken;

    const resolved = await params;
    const segments = resolved.path ?? [];
    const workspacePath =
      "/" + segments.map((s) => decodeURIComponent(s)).join("/");

    // Get the download URL from the Workspace API
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

    // Fetch the actual file content from Shock
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

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=300",
    };

    const contentLength = shockResponse.headers.get("Content-Length");
    if (contentLength) {
      headers["Content-Length"] = contentLength;
    }

    return new NextResponse(shockResponse.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Workspace view API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
