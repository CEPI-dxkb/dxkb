import { type NextRequest, NextResponse } from "next/server";

import { bacterialTreeFilename } from "@/lib/phylogeny/bacterial-tree-index";

export const runtime = "nodejs";

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
    return NextResponse.json(
      {
        error: "Phylogeny tree dictionary is unavailable.",
        code: "upstream_error",
      },
      { status: 502 },
    );
  }
}
