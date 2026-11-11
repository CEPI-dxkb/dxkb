import { NextResponse } from "next/server";

import { getCuratedLists } from "@/lib/taxon-view/curated-lists";

// force-dynamic: with no args or cookies() reads, Next 16 would freeze the
// response at build time instead of re-reading TAXON_VIEW_POLICY_JSON per request.
export const dynamic = "force-dynamic";

export function GET() {
  const lists = getCuratedLists();
  return NextResponse.json({
    sfvtTaxonIds: [...lists.sfvtTaxonIds],
    surveillanceLineageNames: [...lists.surveillanceLineageNames],
    serologyLineageNames: [...lists.serologyLineageNames],
  });
}
