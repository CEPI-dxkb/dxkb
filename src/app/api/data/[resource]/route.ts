import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth/server/session";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { DataApiError, ServerDataRepository } from "@/lib/data-api/repository";
import {
  DataApiValidationError,
  isDataResource,
} from "@/lib/data-api/resources";
import type { DataApiRequest, DataSort } from "@/lib/data-api/types";
import {
  maxRequestBytes,
  validateDataApiRequest,
} from "@/lib/data-api/validation";

const rateLimitMax = 120;
const rateLimitWindowMs = 60_000;

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

async function execute(
  request: NextRequest,
  resourceName: string,
  operation: DataApiRequest,
): Promise<NextResponse> {
  if (!isDataResource(resourceName)) {
    return NextResponse.json(
      {
        error: `Unsupported data resource: ${resourceName}`,
        code: "not_found",
      },
      { status: 404 },
    );
  }
  const blocked = limited(request, resourceName);
  if (blocked) return blocked;

  try {
    const validated = validateDataApiRequest(resourceName, operation);
    const session = await readSession();
    const publicMember = validated.operation === "member" && !session;
    const baseUrl =
      process.env.DATA_API_URL ?? process.env.NEXT_PUBLIC_DATA_API;
    if (!baseUrl) throw new Error("DATA_API_URL is not configured.");
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
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxRequestBytes) {
    return NextResponse.json(
      { error: "Request body is too large.", code: "invalid_request" },
      { status: 413 },
    );
  }
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > maxRequestBytes)
      throw new DataApiValidationError("Request body is too large.");
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
