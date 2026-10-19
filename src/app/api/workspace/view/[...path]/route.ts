import { NextRequest, NextResponse } from "next/server";
import { upstreamServices } from "@/lib/api/upstream-failure";
import { upstreamFailureResponse } from "@/lib/api/upstream-route";
import { contentDisposition, resolveWorkspaceDownload } from "../../resolve-download";

/**
 * Workspace file content proxy route.
 * Resolves a workspace path to a Shock download URL, then streams the file content back.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  try {
    const resolved = await params;
    const segments = resolved.path ?? [];

    const result = await resolveWorkspaceDownload(segments);
    if (result instanceof NextResponse) return result;

    const { shockResponse, filename, contentType } = result;

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition("inline", filename),
      "Cache-Control": "private, no-store",
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
    // Workspace and Shock failures arrive described; a raw one is the file read.
    return upstreamFailureResponse(error, upstreamServices.fileStorage);
  }
}
