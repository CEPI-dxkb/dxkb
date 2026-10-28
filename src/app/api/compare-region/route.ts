import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/auth/server/errors";
import { readSession } from "@/lib/auth/server/session";
import { isCompareRegionGroupFilter } from "@/lib/compare-region/contract";
import {
  CompareRegionBusyError,
  parseCompareRegionQuery,
  readCompareRegion,
} from "@/lib/compare-region/server";
import { rateLimitedResponse } from "@/lib/data-api/route-guards";

/**
 * Same-origin boundary for the Compare Region Viewer: one call to the SEED
 * compare_regions service per request, answered as `{rows}`. The contract
 * lives in `src/lib/compare-region/server.ts`; see `docs/architecture.md` →
 * "Compare Region route contract".
 */
async function answer(request: NextRequest): Promise<NextResponse> {
  const query = parseCompareRegionQuery(request.nextUrl.searchParams);
  if (!query) {
    return NextResponse.json(
      { error: "Invalid compare region request.", code: "invalid_request" },
      { status: 400 },
    );
  }
  const session = await readSession();
  // The service reads a group from the caller's workspace with their token.
  if (isCompareRegionGroupFilter(query.filter) && !session?.token) {
    return NextResponse.json(
      { error: "Sign in to compare against a workspace group.", code: "unauthorized" },
      { status: 401 },
    );
  }
  // Per client IP per minute: each request holds the service's one slot for
  // seconds to a minute.
  const blocked = rateLimitedResponse(request, {
    scope: "compare-region",
    bucket: "rows",
    max: 10,
    windowMs: 60_000,
    message: "Too many Compare Region requests. Please try again shortly.",
  });
  if (blocked) return blocked;

  try {
    const rows = await readCompareRegion(query, session?.token, request.signal);
    return NextResponse.json({ rows });
  } catch (error) {
    if (error instanceof CompareRegionBusyError) {
      return NextResponse.json(
        { error: error.message, code: "server_busy" },
        { status: 503 },
      );
    }
    // A caller that left while waiting is not a failure. The gene is quoted
    // so a line break in it cannot forge a log line.
    if (!request.signal.aborted) {
      console.error(`compare-region ${JSON.stringify(query.peg)}:`, error);
    }
    return errorResponse(error);
  }
}

/**
 * Every answer depends on the caller's cookie (private genomes), a failure as
 * much as a success, so no shared cache may keep one.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const response = await answer(request);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}
