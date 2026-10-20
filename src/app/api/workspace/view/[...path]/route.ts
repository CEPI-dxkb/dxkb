import { NextRequest, NextResponse } from "next/server";
import { upstreamServices } from "@/lib/api/upstream-failure";
import { upstreamFailureResponse } from "@/lib/api/upstream-route";
import { contentDisposition, resolveWorkspaceDownload } from "../../resolve-download";
import { documentErrorResponse, wantsDocument } from "./document-error";

/**
 * Workspace file content proxy route.
 * Resolves a workspace path to a Shock download URL, then streams the file content back.
 * Failures answer JSON `{error, code}`, or a readable HTML page when the
 * request is a document navigation (see `document-error.ts`).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  let segments: string[] = [];
  let failure: NextResponse;
  try {
    const resolved = await params;
    segments = resolved.path ?? [];

    const result = await resolveWorkspaceDownload(segments);
    if (result instanceof NextResponse) {
      failure = result;
    } else {
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
    }
  } catch (error) {
    console.error("Workspace view API error:", error);
    // Workspace and Shock failures arrive described; a raw one is the file read.
    failure = upstreamFailureResponse(error, upstreamServices.fileStorage);
  }
  return wantsDocument(request)
    ? documentErrorResponse(failure, segments)
    : failure;
}
