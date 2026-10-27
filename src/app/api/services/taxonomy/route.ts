import { NextRequest, NextResponse } from "next/server";
import { getRequiredEnv } from "@/lib/env";
import { withErrorHandling } from "@/lib/auth/server/errors";
import { statusToErrorCode } from "@/lib/api/types";
import {
  fetchUpstream,
  upstreamResponseError,
  upstreamTimeoutMs,
} from "@/lib/api/upstream-failure";
import { upstreamFailureResponse } from "@/lib/api/upstream-route";

/** How failure messages name the BV-BRC website API's taxonomy search. */
const taxonomyService = "the BV-BRC taxonomy service";

/**
 * Taxonomy search for the taxon selectors, which print the `error` of a
 * failed answer. So a failure answers `{error, code}` with only an upstream
 * cause: a 5xx or 4xx answer described by `describeUpstreamResponse` (an HTML
 * maintenance page reduced to its title), a timeout as 504, an unreachable
 * host as 502. Anything else (a missing env var) is the generic 500, since its
 * message names server configuration.
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    const baseUrl = getRequiredEnv("BVBRC_WEBSITE_API_URL");

    const response = await fetchUpstream(
      `${baseUrl}/taxonomy?${queryString}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/solrquery+x-www-form-urlencoded",
        },
      },
      // The search is a Solr query on the same backend as the Data API reads.
      { service: taxonomyService, timeoutMs: upstreamTimeoutMs.dataApi },
    );

    if (!response.ok) {
      const failure = await upstreamResponseError(response, taxonomyService);
      console.error("BV-BRC Taxonomy API error:", failure.message);
      return NextResponse.json(
        { error: failure.message, code: statusToErrorCode(failure.status) },
        { status: failure.status },
      );
    }

    const data: unknown = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Taxonomy search failed:", error);
    return upstreamFailureResponse(error, taxonomyService);
  }
});
