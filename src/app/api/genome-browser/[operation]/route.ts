import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth/server/session";
import type { ServerDataRepository } from "@/lib/data-api/repository";
import {
  dataApiErrorResponse,
  dataApiNotConfiguredMessage,
} from "@/lib/data-api/route-errors";
import { rateLimitedResponse } from "@/lib/data-api/route-guards";
import { resolveServerDataRepository } from "@/lib/data-api/server-policy";
import {
  genomeBrowserSequenceCache,
  parseFeaturesQuery,
  parseRegionsQuery,
  parseSequenceQuery,
  readFeatures,
  readRegions,
  readSequence,
  sequenceCacheScope,
} from "@/lib/genome-browser/server";

/** Same-origin boundary for the Genome Browser's JBrowse adapters; region-bounded reads and contig-sliced sequence fit neither the gateway's 200-row page nor its generic validation. */
const genomeBrowserOperations = ["regions", "features", "sequence"] as const;
type GenomeBrowserOperation = (typeof genomeBrowserOperations)[number];

/** Per client IP per minute; `features` allows the most (panning reads both annotation tracks), and a `sequence` miss reads a whole contig, so it gets the `regions` budget. */
const rateLimits: Record<GenomeBrowserOperation, number> = {
  regions: 60,
  features: 300,
  sequence: 60,
};

function isGenomeBrowserOperation(
  value: string,
): value is GenomeBrowserOperation {
  return (genomeBrowserOperations as readonly string[]).includes(value);
}

async function dataRepository(): Promise<ServerDataRepository> {
  const { repository } = await resolveServerDataRepository({
    readScope: "query",
    notConfigured: {
      message: dataApiNotConfiguredMessage,
      log: "Genome Browser route is not configured: set DATA_API_URL (or NEXT_PUBLIC_DATA_API).",
    },
  });
  return repository;
}

async function readOperation(
  operation: GenomeBrowserOperation,
  request: NextRequest,
): Promise<unknown> {
  const params = request.nextUrl.searchParams;
  switch (operation) {
    case "regions": {
      const { genomeId } = parseRegionsQuery(params);
      return readRegions(await dataRepository(), genomeId, request.signal);
    }
    case "features": {
      const query = parseFeaturesQuery(params);
      return readFeatures(await dataRepository(), query, request.signal);
    }
    case "sequence": {
      const query = parseSequenceQuery(params);
      const repository = await dataRepository();
      const session = await readSession();
      return readSequence(repository, query, {
        cache:
          process.env.E2E_MOCK_ENABLED === "1"
            ? null
            : genomeBrowserSequenceCache,
        scope: sequenceCacheScope(session?.token),
      });
    }
  }
}

async function answer(
  request: NextRequest,
  context: { params: Promise<{ operation: string }> },
): Promise<NextResponse> {
  const { operation } = await context.params;
  if (!isGenomeBrowserOperation(operation)) {
    return NextResponse.json(
      {
        error: `Unsupported genome browser operation: ${operation}`,
        code: "not_found",
      },
      { status: 404 },
    );
  }
  const blocked = rateLimitedResponse(request, {
    scope: "genome-browser",
    bucket: operation,
    max: rateLimits[operation],
    windowMs: 60_000,
    message: "Too many Genome Browser requests. Please try again shortly.",
  });
  if (blocked) return blocked;

  try {
    return NextResponse.json(await readOperation(operation, request));
  } catch (error) {
    return dataApiErrorResponse(error);
  }
}

/** Every answer, failures included, depends on the caller's cookie, so the headers are applied at the one place responses leave (`GET`). */
function markPrivate(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ operation: string }> },
): Promise<NextResponse> {
  return markPrivate(await answer(request, context));
}
