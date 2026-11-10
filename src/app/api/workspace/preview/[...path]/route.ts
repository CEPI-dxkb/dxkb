import { NextRequest, NextResponse } from "next/server";
import { upstreamServices } from "@/lib/api/upstream-failure";
import { upstreamFailureResponse } from "@/lib/api/upstream-route";
import {
  resolveWorkspaceDownload,
  workspaceFileHeaders,
} from "../../resolve-download";

const defaultMaxBytes = 2 * 1024 * 1024;
const maxBytesCap = 10 * 1024 * 1024; // matches client previewMaxBytes

/** Like the view route, but reads only the first `?maxBytes=N` bytes (rounded down to the last newline) and sets `X-Truncated: true` when cut. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  try {
    const resolved = await params;
    const segments = resolved.path ?? [];

    const maxBytesParam = request.nextUrl.searchParams.get("maxBytes");
    const parsed = maxBytesParam !== null ? Number(maxBytesParam) : NaN;
    const maxBytes = Number.isNaN(parsed)
      ? defaultMaxBytes
      : Math.min(Math.max(parsed, 1), maxBytesCap);

    const result = await resolveWorkspaceDownload(segments);
    if (result instanceof NextResponse) return result;

    const { shockResponse, filename, contentType } = result;

    const contentLength = shockResponse.headers.get("Content-Length");
    const fileSize = contentLength ? Number(contentLength) : null;

    if (fileSize !== null && fileSize <= maxBytes) {
      const headers: Record<string, string> = {
        ...workspaceFileHeaders(filename, contentType),
        "Cache-Control": "private, max-age=300",
        "Content-Length": String(fileSize),
      };
      return new NextResponse(shockResponse.body, { status: 200, headers });
    }

    const reader = shockResponse.body?.getReader();
    if (!reader) {
      return NextResponse.json(
        { error: "Failed to read file stream" },
        { status: 502 },
      );
    }

    const chunks: Uint8Array[] = [];
    let bytesRead = 0;
    let truncated = false;

    try {
      while (bytesRead < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;

        const remaining = maxBytes - bytesRead;
        if (value.byteLength <= remaining) {
          chunks.push(value);
          bytesRead += value.byteLength;
        } else {
          chunks.push(value.slice(0, remaining));
          bytesRead += remaining;
          truncated = true;
          break;
        }
      }

      if (!truncated && bytesRead >= maxBytes) {
        const { done } = await reader.read();
        truncated = !done;
      }
    } finally {
      reader.cancel().catch(() => {
        /* connection already closed */
      });
    }

    const combined = new Uint8Array(
      await new Blob(chunks as BlobPart[]).arrayBuffer(),
    );

    let finalBytes = combined;
    if (truncated) {
      const newlineCode = 0x0a;
      let lastNewline = -1;
      for (let i = combined.length - 1; i >= 0; i--) {
        if (combined[i] === newlineCode) {
          lastNewline = i;
          break;
        }
      }
      if (lastNewline > 0) {
        finalBytes = combined.slice(0, lastNewline + 1);
      }
    }

    const headers: Record<string, string> = {
      ...workspaceFileHeaders(filename, contentType),
      "Cache-Control": "private, max-age=300",
      "Content-Length": String(finalBytes.byteLength),
    };

    if (truncated) {
      headers["X-Truncated"] = "true";
    }

    return new NextResponse(finalBytes, { status: 200, headers });
  } catch (error) {
    console.error("Workspace preview API error:", error);
    // Workspace and Shock failures arrive described; a raw one is the file read.
    return upstreamFailureResponse(error, upstreamServices.fileStorage);
  }
}
