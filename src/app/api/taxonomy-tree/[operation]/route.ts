import { NextRequest, NextResponse } from "next/server";
import { DataApiValidationError } from "@/lib/data-api/resources";
import {
  dataApiErrorResponse,
  dataApiNotConfiguredMessage,
} from "@/lib/data-api/route-errors";
import { rateLimitedResponse } from "@/lib/data-api/route-guards";
import { resolveServerDataRepository } from "@/lib/data-api/server-policy";
import {
  readTaxonChildCounts,
  readTaxonChildren,
} from "@/lib/data-api/taxonomy-tree";
import { maxRqlInValues } from "@/lib/data-api/rql";

/** Dedicated boundary for the Taxa Tree, not a generic data operation: its 50,000-row child range and `facet_counts` header read must not leak into generic collection and export validation. */
const rateLimitMax = 120;
const rateLimitWindowMs = 60_000;

const taxonomyTreeOperations = ["children", "child-counts"] as const;
type TaxonomyTreeOperation = (typeof taxonomyTreeOperations)[number];

function isTaxonomyTreeOperation(
  value: string,
): value is TaxonomyTreeOperation {
  return (taxonomyTreeOperations as readonly string[]).includes(value);
}

/** Allowlist-check the operation before `limited()`: the rate-limit key includes it. */
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
  return rateLimitedResponse(request, {
    scope: "taxonomy-tree",
    bucket: operation,
    max: rateLimitMax,
    windowMs: rateLimitWindowMs,
    message: "Too many taxonomy requests. Please try again shortly.",
  });
}

/** Positive integers of at most 15 digits (a safe JS integer), which lets the RQL clauses interpolate the id without `validateRql`. */
function parseParentId(value: string | null): number {
  if (value === null || !/^\d{1,15}$/.test(value) || Number(value) <= 0) {
    throw new DataApiValidationError("parentId must be a positive integer.");
  }
  return Number(value);
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
    const parentId =
      operation === "children" ? parseParentId(params.get("parentId")) : null;
    const parentIds =
      operation === "child-counts"
        ? params.getAll("parentId").map(parseParentId)
        : [];
    if (operation === "child-counts") {
      if (parentIds.length === 0) {
        throw new DataApiValidationError("At least one parentId is required.");
      }
      if (parentIds.length > maxRqlInValues) {
        throw new DataApiValidationError(
          `Child counts are limited to ${maxRqlInValues.toLocaleString()} parents per request.`,
        );
      }
    }
    // `readScope: "query"`: both reads vary with the caller's token, so neither is shared-cached.
    const { repository } = await resolveServerDataRepository({
      readScope: "query",
      notConfigured: {
        message: dataApiNotConfiguredMessage,
        log: "Taxa Tree route is not configured: set DATA_API_URL (or NEXT_PUBLIC_DATA_API).",
      },
    });
    const result =
      operation === "children"
        ? await readTaxonChildren(
            repository,
            parentId as number,
            request.signal,
          )
        : await readTaxonChildCounts(repository, parentIds, request.signal);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
    });
  } catch (error) {
    return dataApiErrorResponse(error);
  }
}
