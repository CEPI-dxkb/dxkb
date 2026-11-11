import { NextRequest, NextResponse } from "next/server";
import {
  DataApiValidationError,
  isDataResource,
} from "@/lib/data-api/resources";
import {
  dataApiErrorResponse,
  dataApiNotConfiguredMessage,
} from "@/lib/data-api/route-errors";
import {
  declaresOversizedBody,
  oversizedBodyResponse,
  rateLimitedResponse,
  readCappedBody,
} from "@/lib/data-api/route-guards";
import {
  anonymousMemberRevalidateSeconds,
  readScopeForOperation,
  resolveServerDataRepository,
} from "@/lib/data-api/server-policy";
import type {
  DataApiRequest,
  DataResource,
  DataSort,
  SortKey,
} from "@/lib/data-api/types";
import {
  maxRequestBytes,
  validateDataApiRequest,
} from "@/lib/data-api/validation";

const rateLimitMax = 120;
const rateLimitWindowMs = 60_000;

function limited(request: NextRequest, resource: DataResource) {
  return rateLimitedResponse(request, {
    scope: "data",
    bucket: resource,
    max: rateLimitMax,
    windowMs: rateLimitWindowMs,
    message: "Too many data requests. Please try again shortly.",
  });
}

/** `field:asc` or `field:desc`, then any tie-breaking keys, comma-separated. */
function parseSort(value: string | null): DataSort | undefined {
  if (!value) return undefined;
  const [first, ...then] = value.split(",").map((key): SortKey => {
    const match = /^([^:,]+):(asc|desc)$/.exec(key);
    if (!match)
      throw new DataApiValidationError(
        "Sort must use field:asc or field:desc.",
      );
    return { field: match[1], direction: match[2] as "asc" | "desc" };
  });
  return then.length > 0 ? { ...first, then } : first;
}

function parseKeywordMode(value: string | null): "exact" | "prefix" | undefined {
  if (value === null) return undefined;
  if (value !== "exact" && value !== "prefix") {
    throw new DataApiValidationError("Keyword mode must be exact or prefix.");
  }
  return value;
}

function parsePositiveInteger(value: string | null): number | undefined {
  if (value === null) return undefined;
  if (!/^\d+$/.test(value))
    throw new DataApiValidationError(
      "Numeric parameters must be positive integers.",
    );
  return Number(value);
}

function parseGetRequest(request: NextRequest): DataApiRequest {
  if (request.url.length > maxRequestBytes)
    throw new DataApiValidationError("Request URL is too long.");
  const params = request.nextUrl.searchParams;
  const operation = params.get("operation") ?? "collection";
  if (operation === "member") {
    return {
      operation,
      id: params.get("id") ?? "",
      idField: params.get("idField") ?? undefined,
      fields: params.getAll("field"),
    };
  }
  if (operation !== "collection")
    throw new DataApiValidationError(
      "GET supports collection and member operations only.",
    );
  return {
    operation,
    rql: params.get("rql") ?? undefined,
    keyword: params.get("keyword") ?? undefined,
    keywordMode: parseKeywordMode(params.get("keywordMode")),
    page: parsePositiveInteger(params.get("page")),
    pageSize: parsePositiveInteger(params.get("pageSize")),
    sort: parseSort(params.get("sort")),
    fields: params.getAll("field"),
    facets: params.getAll("facet"),
  };
}

/** Allowlist-check the resource before `limited()`: the rate-limit key includes it, so a raw URL segment would mint unbounded buckets. */
function unsupportedResourceResponse(resourceName: string): NextResponse {
  return NextResponse.json(
    { error: `Unsupported data resource: ${resourceName}`, code: "not_found" },
    { status: 404 },
  );
}

async function execute(
  request: NextRequest,
  resourceName: DataResource,
  operation: DataApiRequest,
): Promise<NextResponse> {
  try {
    const validated = validateDataApiRequest(resourceName, operation);
    // The env var name goes to the operator log, not the response; the distinct
    // `not_configured` code marks a deployment problem rather than a failed request.
    const { repository, sharedCache } = await resolveServerDataRepository({
      readScope: readScopeForOperation(validated.operation),
      notConfigured: {
        message: dataApiNotConfiguredMessage,
        log: "Data API gateway is not configured: set DATA_API_URL (or NEXT_PUBLIC_DATA_API).",
      },
    });
    const result = await repository.execute(
      resourceName,
      validated,
      request.signal,
    );
    // `Vary: Cookie` stays on both branches: a private response becomes
    // shareable once the caller signs out.
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": sharedCache
          ? `public, max-age=0, s-maxage=${String(anonymousMemberRevalidateSeconds)}`
          : "private, no-store",
        Vary: "Cookie",
      },
    });
  } catch (error) {
    return dataApiErrorResponse(error);
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ resource: string }> },
): Promise<NextResponse> {
  const { resource } = await context.params;
  if (!isDataResource(resource)) return unsupportedResourceResponse(resource);
  const blocked = limited(request, resource);
  if (blocked) return blocked;
  try {
    return await execute(request, resource, parseGetRequest(request));
  } catch (error) {
    return dataApiErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ resource: string }> },
): Promise<NextResponse> {
  const { resource } = await context.params;
  if (!isDataResource(resource)) return unsupportedResourceResponse(resource);

  const blocked = limited(request, resource);
  if (blocked) return blocked;

  if (declaresOversizedBody(request, maxRequestBytes))
    return oversizedBodyResponse();

  try {
    const text = await readCappedBody(request, maxRequestBytes);
    if (text === null) return oversizedBodyResponse();
    const body: unknown = JSON.parse(text);
    if (
      !body ||
      typeof body !== "object" ||
      !("operation" in body) ||
      !["selected", "export"].includes(String(body.operation))
    ) {
      throw new DataApiValidationError(
        "POST supports selected and export operations only.",
      );
    }
    return await execute(request, resource, body as DataApiRequest);
  } catch (error) {
    return dataApiErrorResponse(
      error instanceof SyntaxError
        ? new DataApiValidationError("Request body must be valid JSON.")
        : error,
    );
  }
}
