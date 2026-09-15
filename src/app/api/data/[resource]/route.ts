import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth/server/session";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { DataApiError, ServerDataRepository } from "@/lib/data-api/repository";
import {
  DataApiValidationError,
  isDataResource,
} from "@/lib/data-api/resources";
import type { DataApiRequest, DataResource, DataSort } from "@/lib/data-api/types";
import {
  maxRequestBytes,
  validateDataApiRequest,
} from "@/lib/data-api/validation";

const rateLimitMax = 120;
const rateLimitWindowMs = 60_000;

/**
 * Client-facing text for a deployment with no Data API base URL. Stable and
 * distinct from the catch-all's "The data service request failed." so the two
 * failures stay tellable apart, without echoing a server env var name to
 * unauthenticated callers.
 */
const dataApiNotConfiguredMessage =
  "The data service is not configured for this deployment.";

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

function errorResponse(error: unknown): NextResponse {
  if (error instanceof DataApiValidationError) {
    return NextResponse.json(
      { error: error.message, code: "invalid_request" },
      { status: error.status },
    );
  }
  if (error instanceof DataApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return NextResponse.json(
      { error: "Data request was aborted.", code: "aborted" },
      { status: 499 },
    );
  }
  console.error("Data API gateway failed:", error);
  return NextResponse.json(
    { error: "The data service request failed.", code: "internal_error" },
    { status: 500 },
  );
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
 * garbage path segment, the same unbounded-map growth sub-part 1 prunes for.
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
    const session = await readSession();
    const publicMember = validated.operation === "member" && !session;
    const baseUrl =
      process.env.DATA_API_URL ?? process.env.NEXT_PUBLIC_DATA_API;
    // A DataApiError instead of a bare throw: the catch-all below replaces the
    // message with a generic one, so a misconfigured deployment reached clients
    // as "The data service request failed." with nothing to act on. The
    // actionable detail is the env var name, which belongs in the operator's
    // log rather than in a response any caller — signed in or not — can read;
    // the distinct `not_configured` code is what tells a client this is a
    // deployment problem and not a failed request.
    if (!baseUrl) {
      console.error(
        "Data API gateway is not configured: set DATA_API_URL (or NEXT_PUBLIC_DATA_API).",
      );
      throw new DataApiError(
        dataApiNotConfiguredMessage,
        500,
        "not_configured",
      );
    }
    const repository = new ServerDataRepository({
      baseUrl,
      token: session?.token,
      cache: publicMember ? "force-cache" : "no-store",
      revalidate: publicMember ? 300 : undefined,
    });
    const result = await repository.execute(
      resourceName,
      validated,
      request.signal,
    );
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": publicMember
          ? "public, max-age=0, s-maxage=300"
          : "private, no-store",
        Vary: "Cookie",
      },
    });
  } catch (error) {
    return errorResponse(error);
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
    return errorResponse(error);
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
    return errorResponse(
      error instanceof SyntaxError
        ? new DataApiValidationError("Request body must be valid JSON.")
        : error,
    );
  }
}
