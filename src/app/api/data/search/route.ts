import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { upstreamTimeoutMs } from "@/lib/api/upstream-failure";
import type { ServerDataRepository } from "@/lib/data-api/repository";
import { DataApiValidationError } from "@/lib/data-api/resources";
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
import { maxRequestBytes } from "@/lib/data-api/validation";
import {
  allTypesSearchQueries,
  isSearchableKeyword,
  maxSearchKeywordLength,
  taxonGenomeCountKeyPrefix,
  taxonGenomeCountQueries,
} from "@/lib/search/all-types-query";

/** All-data-types search: `POST {keyword}` answered with every type's top matches; the per-type queries are built here so no caller-written RQL reaches the Data API with the caller's token. */
const rateLimitMax = 120;
const rateLimitWindowMs = 60_000;

const searchRequestSchema = z.object({
  keyword: z.string().max(maxSearchKeywordLength),
});

const digitsOnly = /^\d+$/;

function taxonIdsOf(matches: Record<string, unknown>): string[] {
  const taxonomy = matches.taxonomy as
    | { result?: { response?: { docs?: ({ taxon_id?: unknown } | null)[] } } }
    | undefined;
  const docs = taxonomy?.result?.response?.docs;
  if (!Array.isArray(docs)) return [];
  const ids = docs
    .map((doc) => {
      const taxonId = doc?.taxon_id;
      return typeof taxonId === "number" || typeof taxonId === "string"
        ? String(taxonId)
        : "";
    })
    .filter((id) => digitsOnly.test(id));
  return [...new Set(ids)];
}

/** One batched count per taxon hit, so the page's genome figures follow the Taxonomy header's definition instead of the stored `taxonomy.genomes` field. A failure, or no answer within its short budget, leaves the counts out (the page omits the figure) and is logged, never replaced by the stored value; an aborted search still answers as aborted. Only `taxonGenomes:` entries are kept, so the answer cannot replace a type match. */
async function taxonGenomeCounts(
  repository: ServerDataRepository,
  matches: Record<string, unknown>,
  signal: AbortSignal,
): Promise<Record<string, unknown>> {
  const taxonIds = taxonIdsOf(matches);
  if (taxonIds.length === 0) return {};
  try {
    const counts = await repository.multiQuery(
      taxonGenomeCountQueries(taxonIds),
      signal,
      upstreamTimeoutMs.dataApiSearchGenomeCounts,
    );
    return Object.fromEntries(
      Object.entries(counts).filter(([key]) =>
        key.startsWith(taxonGenomeCountKeyPrefix),
      ),
    );
  } catch (error) {
    if (signal.aborted) throw error;
    console.error("search: taxon genome counts failed", error);
    return {};
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const blocked = rateLimitedResponse(request, {
    scope: "data-search",
    bucket: "all-types",
    max: rateLimitMax,
    windowMs: rateLimitWindowMs,
    message: "Too many searches. Please try again shortly.",
  });
  if (blocked) return blocked;
  if (declaresOversizedBody(request, maxRequestBytes))
    return oversizedBodyResponse();

  try {
    const text = await readCappedBody(request, maxRequestBytes);
    if (text === null) return oversizedBodyResponse();
    const parsed = searchRequestSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      throw new DataApiValidationError(
        `Search needs a keyword of at most ${String(maxSearchKeywordLength)} characters.`,
      );
    }
    const { keyword } = parsed.data;
    if (!isSearchableKeyword(keyword))
      throw new DataApiValidationError("Enter a search term.");

    const { repository } = await resolveServerDataRepository({
      readScope: "query",
      notConfigured: {
        message: dataApiNotConfiguredMessage,
        log: "Search route: Data API gateway is not configured: set DATA_API_URL (or NEXT_PUBLIC_DATA_API).",
      },
    });
    const matches = await repository.multiQuery(
      allTypesSearchQueries(keyword),
      request.signal,
    );
    const counts = await taxonGenomeCounts(repository, matches, request.signal);
    return NextResponse.json(
      { ...matches, ...counts },
      { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } },
    );
  } catch (error) {
    return dataApiErrorResponse(
      error instanceof SyntaxError
        ? new DataApiValidationError("Request body must be valid JSON.")
        : error,
    );
  }
}
