import { NextRequest, NextResponse } from "next/server";
import {
  isCircularViewerOperation,
  isSpecialtyPresetId,
  type CircularViewerOperation,
} from "@/lib/circular-viewer/contract";
import {
  customTrackFilter,
  featurePresetFilters,
  parseCustomQuery,
  parseGenomeQuery,
  parseTrackQuery,
  readContigs,
  readFeatureTrack,
  readGc,
  readSpecialtyTrack,
  specialtyProperties,
} from "@/lib/circular-viewer/server";
import type { ServerDataRepository } from "@/lib/data-api/repository";
import {
  dataApiErrorResponse,
  dataApiNotConfiguredMessage,
} from "@/lib/data-api/route-errors";
import { rateLimitedResponse } from "@/lib/data-api/route-guards";
import { resolveServerDataRepository } from "@/lib/data-api/server-policy";

/**
 * Same-origin boundary for the Circular Viewer, apart from `/api/data/[resource]`
 * for the Genome Browser's reason: whole-genome track reads (up to 25,000
 * features) and GC computed from whole sequences fit neither the gateway's
 * 200-row page nor its generic validation. Contract in
 * `src/lib/circular-viewer/server.ts`; see `docs/architecture.md` →
 * "Circular Viewer route contract".
 */

/**
 * Per client IP per minute. Opening the tab costs one `contigs`, seven
 * `track` and one `gc`; custom tracks are typed one at a time; `gc` reads
 * every sequence whole, so it gets the least.
 */
const rateLimits: Record<CircularViewerOperation, number> = {
  contigs: 60,
  track: 120,
  custom: 30,
  gc: 20,
};

/** `"query"`: every answer depends on the caller's token (private genomes). */
async function dataRepository(): Promise<ServerDataRepository> {
  const { repository } = await resolveServerDataRepository({
    readScope: "query",
    notConfigured: {
      message: dataApiNotConfiguredMessage,
      log: "Circular Viewer route is not configured: set DATA_API_URL (or NEXT_PUBLIC_DATA_API).",
    },
  });
  return repository;
}

/** Parameters are validated before the repository is resolved, so a bad request is a 400 even unconfigured. */
async function readOperation(
  operation: CircularViewerOperation,
  request: NextRequest,
): Promise<unknown> {
  const params = request.nextUrl.searchParams;
  switch (operation) {
    case "contigs": {
      const { genomeId } = parseGenomeQuery(params);
      return readContigs(await dataRepository(), genomeId, request.signal);
    }
    case "track": {
      const { genomeId, preset } = parseTrackQuery(params);
      const repository = await dataRepository();
      return isSpecialtyPresetId(preset)
        ? readSpecialtyTrack(repository, genomeId, specialtyProperties[preset], request.signal)
        : readFeatureTrack(repository, genomeId, featurePresetFilters[preset], request.signal);
    }
    case "custom": {
      const { genomeId, ...query } = parseCustomQuery(params);
      return readFeatureTrack(
        await dataRepository(),
        genomeId,
        customTrackFilter(query),
        request.signal,
      );
    }
    case "gc": {
      const { genomeId } = parseGenomeQuery(params);
      return readGc(await dataRepository(), genomeId, request.signal);
    }
  }
}

async function answer(
  request: NextRequest,
  context: { params: Promise<{ operation: string }> },
): Promise<NextResponse> {
  const { operation } = await context.params;
  // Allowlist before the rate-limit key, so a garbage segment cannot mint a bucket.
  if (!isCircularViewerOperation(operation)) {
    return NextResponse.json(
      { error: `Unsupported circular viewer operation: ${operation}`, code: "not_found" },
      { status: 404 },
    );
  }
  const blocked = rateLimitedResponse(request, {
    scope: "circular-viewer",
    bucket: operation,
    max: rateLimits[operation],
    windowMs: 60_000,
    message: "Too many Circular Viewer requests. Please try again shortly.",
  });
  if (blocked) return blocked;
  try {
    return NextResponse.json(await readOperation(operation, request));
  } catch (error) {
    return dataApiErrorResponse(error);
  }
}

/** Every answer, a failure as much as a success, depends on the caller's cookie. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ operation: string }> },
): Promise<NextResponse> {
  const response = await answer(request, context);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}
