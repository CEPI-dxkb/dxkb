import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  DataApiValidationError,
  isDataResource,
} from "@/lib/data-api/resources";
import {
  dataApiErrorResponse,
  dataApiNotConfiguredMessage,
} from "@/lib/data-api/route-errors";
import {
  anonymousMemberRevalidateSeconds,
  readScopeForOperation,
  resolveServerDataRepository,
} from "@/lib/data-api/server-policy";
import type { DataApiRequest, DataResource, DataSort } from "@/lib/data-api/types";
import {
  maxRequestBytes,
  validateDataApiRequest,
} from "@/lib/data-api/validation";

const rateLimitMax = 120;
const rateLimitWindowMs = 60_000;

/**
 * Single response contract for every oversized-body rejection path (a
 * declared Content-Length over the cap, or the byte-capped read below hitting
 * the cap while streaming a chunked or understated-length body). All three
 * paths used to diverge: some returned 413, one threw a validation error that
 * turned into 400. One shape now, one status, for equivalent input.
 */
function oversizedBodyResponse(): NextResponse {
  return NextResponse.json(
    { error: "Request body is too large.", code: "invalid_request" },
    { status: 413 },
  );
}

/**
 * Reads `request`'s body up to `maxBytes`, tracking the running byte count as
 * chunks arrive instead of buffering the whole stream and measuring it
 * afterwards. Returns the decoded text on success, or `null` as soon as the
 * running total exceeds `maxBytes` — the reader is cancelled at that point,
 * so a chunked or understated-Content-Length body that lies about its size
 * is never fully consumed.
 */
async function readCappedBody(
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

function parseSort(value: string | null): DataSort | undefined {
  if (!value) return undefined;
  const match = /^([^:]+):(asc|desc)$/.exec(value);
  if (!match)
    throw new DataApiValidationError("Sort must use field:asc or field:desc.");
  return { field: match[1], direction: match[2] as "asc" | "desc" };
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

function limited(request: NextRequest, resource: string): NextResponse | null {
  const limit = rateLimit(
    `data:${clientIp(request)}:${resource}`,
    rateLimitMax,
    rateLimitWindowMs,
  );
  if (limit.allowed) return null;
  return NextResponse.json(
    {
      error: "Too many data requests. Please try again shortly.",
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
 * `data:${clientIp}:${resourceName}` is the rate-limit key, so a resource
 * name straight from the URL must be allowlist-checked before it ever reaches
 * `limited()` — otherwise an attacker can mint one rate-limit bucket per
 * garbage path segment: the same unbounded-map growth that
 * `src/lib/rate-limit.ts`'s `pruneExpiredBuckets` sweep (gated on
 * `pruneThreshold` and `pruneIntervalMs`) exists to bound.
 */
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
    // Session lookup, env resolution, missing-configuration handling,
    // repository construction, and cache policy all come from
    // `resolveServerDataRepository`, shared with the page factory
    // (`createServerDataRepository`) and the Taxa Tree route. This route used
    // to reimplement all five, and disagreed with the factory on anonymous
    // collections and on E2E mode.
    //
    // What stays here: the sanitized client-facing message paired with an
    // operator-facing log. The actionable detail is the env var name, which
    // belongs in the operator's log rather than in a response any caller —
    // signed in or not — can read. The distinct `not_configured` code is what
    // tells a client this is a deployment problem and not a failed request;
    // without it the catch-all below would answer "The data service request
    // failed." with nothing to act on.
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
    // `sharedCache` is true only for an anonymous, non-E2E member read; the
    // shared window below is the same constant the repository's own
    // `next.revalidate` uses, so the two cannot drift. `Vary: Cookie` stays on
    // both branches: a response that is private today becomes shareable the
    // moment the caller signs out, and the cache has to be told that.
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

  // Admission checks — rate limit, then declared size — run before any body
  // read, so a rejected request never pays for one.
  const blocked = limited(request, resource);
  if (blocked) return blocked;

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxRequestBytes) return oversizedBodyResponse();

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
