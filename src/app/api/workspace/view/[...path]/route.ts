import { NextRequest, NextResponse } from "next/server";
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
