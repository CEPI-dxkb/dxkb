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

/**
 * Same-origin boundary for the Genome Browser's JBrowse adapters, deliberately
 * not an operation on `/api/data/[resource]`: region-bounded reads with their
 * own row and span bounds, and sequence sliced from a whole contig, fit neither
 * the gateway's 200-row page nor its generic validation. The contract lives in
 * `src/lib/genome-browser/server.ts`; see `docs/architecture.md` →
 * "Genome Browser route contract".
 */
const genomeBrowserOperations = ["regions", "features", "sequence"] as const;
type GenomeBrowserOperation = (typeof genomeBrowserOperations)[number];

/**
 * Per client IP per minute. Panning reads feature chunks for both annotation
 * tracks at once (one request per track covers up to ten 100 kb chunks), so
 * `features` allows the most. `sequence` is read only when zoomed in to bases
 * (one request covers up to five 20 kb chunks), and a miss makes the server
 * read a whole contig, so it gets the `regions` budget. The process-wide cap
 * on whole-contig loads in `SequenceCache` bounds what many clients together
 * can start.
 */
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

/** `"query"`: every answer depends on the caller's token (private genomes). */
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

/**
 * Each operation validates its parameters before the repository is resolved,
 * so a malformed request answers 400 even where the Data API is not configured.
 */
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
        // An E2E run never caches (same rule as the Data API gateway).
        cache:
          process.env.E2E_MOCK_ENABLED === "1"
            ? null
            : genomeBrowserSequenceCache,
        // The token, not the user id: see `sequenceCacheScope`.
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
  // Allowlist before the rate-limit key, so a garbage segment cannot mint a bucket.
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

/**
 * Every answer depends on the caller's cookie, a failure as much as a success:
 * an upstream 401, 403 or a private genome's 404 differs by token, and a shared
 * cache must neither keep it nor serve it to someone else. Applied to the one
 * place every response leaves (`GET`), so the 404, the 429 and each
 * `dataApiErrorResponse` result carry the headers too.
 */
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
