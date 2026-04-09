import { NextRequest, NextResponse } from "next/server";
import { contentDisposition, resolveWorkspaceDownload } from "../../resolve-download";

const defaultMaxBytes = 2 * 1024 * 1024; // 2 MB default
const maxBytesCap = 10 * 1024 * 1024; // 10 MB server-enforced cap (matches client previewMaxBytes)

/**
 * Workspace file preview proxy route.
 * Like the view route, but reads only the first N bytes (rounded down to the
 * last newline) so that large files never blow up the client.
 *
 * Query params:
 *   ?maxBytes=N  — requested byte limit (default 2 MB, capped at 10 MB)
 *
 * Response headers:
 *   X-Truncated: true  — set when the response was truncated
 */
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

    // Check if the file is small enough to return in full
    const contentLength = shockResponse.headers.get("Content-Length");
    const fileSize = contentLength ? Number(contentLength) : null;

    if (fileSize !== null && fileSize <= maxBytes) {
      const headers: Record<string, string> = {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition("inline", filename),
        "Cache-Control": "private, max-age=300",
        "Content-Length": String(fileSize),
      };
      return new NextResponse(shockResponse.body, { status: 200, headers });
    }

    // Large file — read only the first maxBytes, rounding down to the last newline
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
      reader.cancel().catch(() => { /* connection already closed */ });
    }

    // Combine chunks into a single buffer
    const combined = new Uint8Array(bytesRead);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }

    // If truncated, round down to the last newline for clean line breaks
    let finalBytes = combined;
    if (truncated) {
      const newlineCode = 0x0a; // \n
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
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition("inline", filename),
      "Cache-Control": "private, max-age=300",
      "Content-Length": String(finalBytes.byteLength),
    };

    if (truncated) {
      headers["X-Truncated"] = "true";
    }

    return new NextResponse(finalBytes, { status: 200, headers });
  } catch (error) {
    console.error("Workspace preview API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
