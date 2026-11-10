import { type NextRequest, NextResponse } from "next/server";

import { describeUpstreamFailure } from "@/lib/api/upstream-failure";
import { bacterialTreeFilename } from "@/lib/phylogeny/bacterial-tree-index";

export const runtime = "nodejs";

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
    // An upstream failure keeps its cause and status; any other error's
    // message is internal and stays in the log.
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
