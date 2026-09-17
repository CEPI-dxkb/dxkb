import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth/server/session";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { DataApiError, ServerDataRepository } from "@/lib/data-api/repository";
import { DataApiValidationError } from "@/lib/data-api/resources";
import {
  dataApiErrorResponse,
  dataApiNotConfiguredMessage,
} from "@/lib/data-api/route-errors";
import {
  readTaxonChildCounts,
  readTaxonChildren,
} from "@/lib/data-api/taxonomy-tree";

/**
 * Dedicated same-origin boundary for the Taxa Tree, deliberately *not* an
 * operation on `/api/data/[resource]`.
 *
 * The tree asks for one node's children in a single upstream range bounded by
 * `taxonChildrenPageSize` (50,000), and reads its child counts out of a
 * `facet_counts` response header.
 * Neither fits the generic gateway: the collection operation is fixed at a
 * 200-row page and validates every request through `validateDataApiRequest`,
 * and no generic operation reads response headers at all. Threading this
 * contract through that validation and limit policy is what would let the
 * exceptional bound leak into generic collection and export requests, so the
 * bound, the two RQL clauses, and the facet parser live together in
 * `src/lib/data-api/taxonomy-tree.ts` and are reachable only from here.
 *
 * Both operations reuse `ServerDataRepository` — the same authenticated
 * transport the gateway uses, with the same HTTPS-with-token guard, Range
 * headers, and upstream error mapping.
 */
const rateLimitMax = 120;
const rateLimitWindowMs = 60_000;

const taxonomyTreeOperations = ["children", "child-counts"] as const;
type TaxonomyTreeOperation = (typeof taxonomyTreeOperations)[number];

function isTaxonomyTreeOperation(
  value: string,
): value is TaxonomyTreeOperation {
  return (taxonomyTreeOperations as readonly string[]).includes(value);
}

/**
 * `taxonomy-tree:${clientIp}:${operation}` is the rate-limit key, so the
 * operation segment must be allowlist-checked before it reaches `limited()` —
 * otherwise a caller can mint one rate-limit bucket per garbage path segment.
 * Same ordering, for the same reason, as `/api/data/[resource]`.
 */
function unsupportedOperationResponse(operation: string): NextResponse {
  return NextResponse.json(
    {
      error: `Unsupported taxonomy tree operation: ${operation}`,
      code: "not_found",
    },
    { status: 404 },
  );
}

function limited(
  request: NextRequest,
  operation: TaxonomyTreeOperation,
): NextResponse | null {
  const limit = rateLimit(
    `taxonomy-tree:${clientIp(request)}:${operation}`,
    rateLimitMax,
    rateLimitWindowMs,
  );
  if (limit.allowed) return null;
  return NextResponse.json(
    {
      error: "Too many taxonomy requests. Please try again shortly.",
      code: "rate_limited",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)),
      },
    },
  );
}

/**
 * Taxon ids are positive integers. Fifteen digits is the widest value that
 * stays a safe JavaScript integer, and rejecting anything else here is what
 * lets `taxonChildrenClause` / `taxonChildCountsClause` interpolate straight
 * into RQL without going through `validateRql`.
 */
function parseParentId(value: string | null): number {
  if (value === null || !/^\d{1,15}$/.test(value) || Number(value) <= 0) {
    throw new DataApiValidationError("parentId must be a positive integer.");
  }
  return Number(value);
}

async function buildRepository(): Promise<ServerDataRepository> {
  const baseUrl = process.env.DATA_API_URL ?? process.env.NEXT_PUBLIC_DATA_API;
  // Same treatment as the gateway's identical condition: the actionable detail
  // is the env var name, which belongs in the operator's log rather than in a
  // response any caller can read, and the `not_configured` code is what tells
  // a client this is a deployment problem and not a failed request.
  if (!baseUrl) {
    console.error(
      "Taxa Tree route is not configured: set DATA_API_URL (or NEXT_PUBLIC_DATA_API).",
    );
    throw new DataApiError(dataApiNotConfiguredMessage, 500, "not_configured");
  }
  const session = await readSession();
  return new ServerDataRepository({
    baseUrl,
    token: session?.token,
    cache: "no-store",
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ operation: string }> },
): Promise<NextResponse> {
  const { operation } = await context.params;
  if (!isTaxonomyTreeOperation(operation))
    return unsupportedOperationResponse(operation);
  const blocked = limited(request, operation);
  if (blocked) return blocked;

  try {
    const params = request.nextUrl.searchParams;
    const repository = await buildRepository();
    const result =
      operation === "children"
        ? await readTaxonChildren(
            repository,
            parseParentId(params.get("parentId")),
            request.signal,
          )
        : await readTaxonChildCounts(
            repository,
            params.getAll("parentId").map((value) => parseParentId(value)),
            request.signal,
          );
    // Both answers vary with the caller's token, which decides what the
    // upstream counts as a visible genome, so neither is shared-cacheable.
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
    });
  } catch (error) {
    return dataApiErrorResponse(error);
  }
}
