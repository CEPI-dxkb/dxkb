import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Admission checks shared by the Data API routes, so a rate-limited or
 * oversized request is answered in one shape whichever route it hit.
 */

interface RateLimitPolicy {
  scope: string;
  /**
   * Must be allowlist-checked: a raw path segment would let a caller mint one
   * bucket per garbage value.
   */
  bucket: string;
  max: number;
  windowMs: number;
  message: string;
}

export function rateLimitedResponse(
  request: NextRequest,
  { scope, bucket, max, windowMs, message }: RateLimitPolicy,
): NextResponse | null {
  const limit = rateLimit(
    `${scope}:${clientIp(request)}:${bucket}`,
    max,
    windowMs,
  );
  if (limit.allowed) return null;
  return NextResponse.json(
    { error: message, code: "rate_limited" },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)),
      },
    },
  );
}

/**
 * One response for every oversized-body path, whether declared by
 * Content-Length or hit while streaming.
 */
export function oversizedBodyResponse(): NextResponse {
  return NextResponse.json(
    { error: "Request body is too large.", code: "invalid_request" },
    { status: 413 },
  );
}

export function declaresOversizedBody(
  request: NextRequest,
  maxBytes: number,
): boolean {
  return Number(request.headers.get("content-length") ?? 0) > maxBytes;
}

/**
 * Cancels the reader as soon as the running total exceeds `maxBytes`, so a body
 * that lies about its size is never fully consumed.
 */
export async function readCappedBody(
  request: NextRequest,
  maxBytes: number,
): Promise<string | null> {
  const stream = request.body;
  if (!stream) return "";
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}
