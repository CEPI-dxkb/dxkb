import { NextRequest, NextResponse } from "next/server";
import { DataApiValidationError } from "@/lib/data-api/resources";
import { fastaContentType, isFastaResource } from "@/lib/data-api/fasta";
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
import { resolveServerDataRepository } from "@/lib/data-api/server-policy";
import {
  maxRequestBytes,
  validateFastaRequest,
} from "@/lib/data-api/validation";

/**
 * FASTA downloads: `POST {type, ids}` → the upstream's FASTA, streamed.
 *
 * A sub-route rather than an `operation` on `/api/data/[resource]`, for the
 * reason the Taxa Tree has its own route: every generic operation answers with
 * JSON through one `execute()`, and this one answers with a text stream that
 * may be megabytes long. Everything else is shared — the session-aware
 * repository and its upstream error mapping, the admission guards, and the
 * `{error, code}` error contract.
 *
 * Which resources and sequence types are served is decided by
 * `fastaResources` in `src/lib/data-api/fasta.ts`, not here.
 */
const rateLimitMax = 30;
const rateLimitWindowMs = 60_000;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ resource: string }> },
): Promise<NextResponse> {
  const { resource } = await context.params;
  // Allowlisted before the rate limit: the resource is part of the bucket key.
  if (!isFastaResource(resource)) {
    return NextResponse.json(
      {
        error: `FASTA downloads are not available for ${resource}.`,
        code: "not_found",
      },
      { status: 404 },
    );
  }
  const blocked = rateLimitedResponse(request, {
    scope: "data-fasta",
    bucket: resource,
    max: rateLimitMax,
    windowMs: rateLimitWindowMs,
    message: "Too many sequence downloads. Please try again shortly.",
  });
  if (blocked) return blocked;
  if (declaresOversizedBody(request, maxRequestBytes))
    return oversizedBodyResponse();

  try {
    const text = await readCappedBody(request, maxRequestBytes);
    if (text === null) return oversizedBodyResponse();
    const fastaRequest = validateFastaRequest(resource, JSON.parse(text));
    // `"query"`: an id list is near-unique per caller, and an authenticated
    // caller can see private genomes, so a FASTA response is never shared.
    const { repository } = await resolveServerDataRepository({
      readScope: "query",
      notConfigured: {
        message: dataApiNotConfiguredMessage,
        log: "FASTA download gateway is not configured: set DATA_API_URL (or NEXT_PUBLIC_DATA_API).",
      },
    });
    const body = await repository.fasta(
      resource,
      fastaRequest,
      request.signal,
    );
    return new NextResponse(body, {
      headers: {
        "Content-Type": `${fastaContentType}; charset=utf-8`,
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
      },
    });
  } catch (error) {
    return dataApiErrorResponse(
      error instanceof SyntaxError
        ? new DataApiValidationError("Request body must be valid JSON.")
        : error,
    );
  }
}
