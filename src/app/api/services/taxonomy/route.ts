import { NextRequest, NextResponse } from "next/server";
import { getRequiredEnv } from "@/lib/env";
import { withErrorHandling } from "@/lib/auth/server/errors";
import {
  fetchUpstream,
  upstreamResponseError,
  upstreamTimeoutMs,
} from "@/lib/api/upstream-failure";
import {
  isUpstreamDown,
  isUpstreamOutageError,
} from "@/lib/api/upstream-outage";
import { upstreamFailureResponse } from "@/lib/api/upstream-route";
import { createSharedCache } from "@/lib/shared-cache";

const taxonomyService = "the BV-BRC taxonomy service";

const maxCachedQueryLength = 2048;

// The form clients' parameters only: others (`rows`, `start`, `facet.*`, any
// unknown name) let a public caller size and multiply the hour-long entries.
const cacheableParams = new Set(["q", "fl", "qf", "sort", "fq"]);

// Plain field names only, since an `fl` alias, `[transformer]` or function
// lets one request inflate every row of the entry.
const plainFieldList = /^[A-Za-z_]\w*(,[A-Za-z_]\w*)*$/;

/** Logs an outage here; any other failure is logged by whoever answers it (the cache for a background refresh, the GET handler otherwise). */
async function loadTaxonomySearch(query: string): Promise<unknown> {
  try {
    const baseUrl = getRequiredEnv("BVBRC_WEBSITE_API_URL");
    const response = await fetchUpstream(
      `${baseUrl}/taxonomy?${query}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/solrquery+x-www-form-urlencoded",
        },
      },
      { service: taxonomyService, timeoutMs: upstreamTimeoutMs.dataApi },
    );
    if (response.ok) {
      const data: unknown = await response.json();
      return data;
    }
    throw await upstreamResponseError(response, taxonomyService);
  } catch (error) {
    if (isUpstreamOutageError(error, taxonomyService)) {
      console.error("Taxonomy search failed:", error);
    }
    throw error;
  }
}

// Autocomplete sends many distinct queries, so during an outage the breaker,
// not the per-key cache, keeps each keystroke from waiting out the budget. A
// 4xx (a bad query) is neither cached nor counted.
const taxonomySearchCache = createSharedCache<string, unknown>({
  name: "taxonomy-search",
  load: (query) => loadTaxonomySearch(query),
  freshMs: 60 * 60 * 1000,
  retryMs: 60_000,
  maxEntries: 1000,
  cacheError: (error) => isUpstreamOutageError(error, taxonomyService),
  breaker: {
    trips: (error, elapsedMs) =>
      isUpstreamDown(error, taxonomyService, {
        elapsedMs,
        budgetMs: upstreamTimeoutMs.dataApi,
      }),
  },
});

// Concurrent requests share one in-flight load, so each waiting handler gets the same error object.
const loggedFailures = new WeakSet<object>();

/** Sorted by name so reordered parameters share an entry; the stable sort keeps repeated names in order. */
function searchKey(searchParams: URLSearchParams): string {
  const params = new URLSearchParams(searchParams);
  params.sort();
  return params.toString();
}

/** A failure answers `{error, code}` with only an upstream cause; anything else (a missing env var) is the generic 500, since its message names server configuration. */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const query = searchKey(searchParams);
  const cacheable =
    query.length <= maxCachedQueryLength &&
    [...searchParams.keys()].every((name) => cacheableParams.has(name)) &&
    searchParams.getAll("fl").every((fields) => plainFieldList.test(fields));
  try {
    const data = cacheable
      ? await taxonomySearchCache.get(query)
      : await loadTaxonomySearch(query);
    return NextResponse.json(data);
  } catch (error) {
    // An outage was logged by its loader; a cached one or a breaker fast-fail is served unlogged.
    if (!isUpstreamOutageError(error, taxonomyService)) {
      const isObject = typeof error === "object" && error !== null;
      if (!isObject || !loggedFailures.has(error)) {
        console.error("Taxonomy search failed:", error);
        if (isObject) loggedFailures.add(error);
      }
    }
    return upstreamFailureResponse(error, taxonomyService);
  }
});
