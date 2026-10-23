import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Admission checks shared by the Data API routes (`/api/data/[resource]`,
 * `/api/data/search`, `/api/data/[resource]/fasta`,
 * `/api/data/[resource]/download`, `/api/taxonomy-tree/[operation]` and
 * `/api/genome-browser/[operation]`) and `/api/compare-region` (rate limit
 * only), so a rate-limited or oversized request is answered in one shape
 * whichever of them it hit.
 */

interface RateLimitPolicy {
  /** Route family, the key's first segment (`data`, `taxonomy-tree`, …). */
  scope: string;
  /**
   * What inside the family is limited: a resource or operation name. It must
   * already be allowlist-checked, because the bucket key is
   * `${scope}:${clientIp}:${bucket}` and a raw path segment would let a
   * caller mint one bucket per garbage value — the unbounded-map growth that
   * `src/lib/rate-limit.ts`'s prune sweep exists to bound.
   */
  bucket: string;
  max: number;
  windowMs: number;
  /** Client-facing text naming what was limited. */
  message: string;
}

/** `429` with `Retry-After` once the caller's bucket is spent, else `null`. */
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
 * Single response contract for every oversized-body rejection path (a
 * declared Content-Length over the cap, or the byte-capped read below hitting
 * the cap while streaming a chunked or understated-length body). The paths
 * used to diverge: some returned 413, one threw a validation error that
 * turned into 400. One shape now, one status, for equivalent input.
 */
export function oversizedBodyResponse(): NextResponse {
  return NextResponse.json(
    { error: "Request body is too large.", code: "invalid_request" },
    { status: 413 },
  );
}

/** Whether the declared `Content-Length` alone already exceeds `maxBytes`. */
export function declaresOversizedBody(
  request: NextRequest,
  maxBytes: number,
): boolean {
  return Number(request.headers.get("content-length") ?? 0) > maxBytes;
}

/**
 * Reads `request`'s body up to `maxBytes`, tracking the running byte count as
 * chunks arrive instead of buffering the whole stream and measuring it
 * afterwards. Returns the decoded text on success, or `null` as soon as the
 * running total exceeds `maxBytes` — the reader is cancelled at that point,
 * so a chunked or understated-Content-Length body that lies about its size
 * is never fully consumed.
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
