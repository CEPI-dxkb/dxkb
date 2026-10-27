import { type NextRequest, NextResponse } from "next/server";

import { describeUpstreamFailure } from "@/lib/api/upstream-failure";
import { bacterialTreeFilename } from "@/lib/phylogeny/bacterial-tree-index";

export const runtime = "nodejs";

/** How failure messages name the upstream this route reads. */
const dictionaryService = "the BV-BRC phylogeny tree dictionary";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ taxonId: string }> },
) {
  const { taxonId } = await context.params;
  if (!/^[1-9]\d*$/.test(taxonId)) {
    return NextResponse.json(
      { error: "Taxon ID must be a positive integer.", code: "invalid_request" },
      { status: 400 },
    );
  }
  try {
    const filename = await bacterialTreeFilename(Number(taxonId));
    return NextResponse.json(
      { filename },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  } catch (error) {
    console.error("phylogeny tree dictionary unavailable", error);
    // An upstream failure (`UpstreamError`, or undici's network error) keeps
    // its cause and status: "… is unavailable (HTTP 503 Service Unavailable:
    // Site Maintenance)", "… did not respond (timed out after 30 s)". Any
    // other error's message is internal (parser detail, addresses) and stays
    // in the log.
    const failure = describeUpstreamFailure(error, dictionaryService);
    if (failure) {
      return NextResponse.json(
        { error: failure.message, code: failure.code },
        { status: failure.status },
      );
    }
    return NextResponse.json(
      {
        error: "Phylogeny tree dictionary is unavailable.",
        code: "upstream_error",
      },
      { status: 502 },
    );
  }
}
