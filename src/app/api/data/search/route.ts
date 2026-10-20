import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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
} from "@/lib/search/all-types-query";

/**
 * The all-data-types search (`/search?type=everything`): `POST {keyword}`,
 * answered with every DXKB type's top matches from the Data API's one
 * multi-query request, keyed by type.
 *
 * It used to run in the browser, straight against
 * `p3.theseed.org/services/data_api/query/`: no budget (a down host took
 * Chrome's ~75 s TCP timeout to fail, as "Failed to fetch") and the response
 * body dropped. Through `ServerDataRepository.multiQuery` it shares the
 * gateway's budget, failure mapping, token and HTTPS guard, and its
 * `{error, code}` answers.
 *
 * The caller names only the keyword; the per-type queries are built here
 * (`allTypesSearchQueries`), so no caller-written RQL reaches the Data API
 * with the caller's token.
 */
const rateLimitMax = 120;
const rateLimitWindowMs = 60_000;

const searchRequestSchema = z.object({
  keyword: z.string().max(maxSearchKeywordLength),
});

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
    return NextResponse.json(matches, {
      headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
    });
  } catch (error) {
    return dataApiErrorResponse(
      error instanceof SyntaxError
        ? new DataApiValidationError("Request body must be valid JSON.")
        : error,
    );
  }
}
