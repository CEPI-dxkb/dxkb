import { NextRequest, NextResponse } from "next/server";
import { upstreamServices } from "@/lib/api/upstream-failure";
import { upstreamFailureResponse } from "@/lib/api/upstream-route";
import {
  resolveWorkspaceDownload,
  workspaceFileHeaders,
} from "../../resolve-download";
import { documentErrorResponse, wantsDocument } from "./document-error";

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
        ...workspaceFileHeaders(filename, contentType),
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
    failure = upstreamFailureResponse(error, upstreamServices.fileStorage);
  }
  return wantsDocument(request)
    ? documentErrorResponse(failure, segments)
    : failure;
}
