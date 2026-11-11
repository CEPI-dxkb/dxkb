import { upstreamServices } from "@/lib/api/upstream-failure";
import { isUpstreamOutageError } from "@/lib/api/upstream-outage";

import { lineageCrumbs, type LineageCrumb } from "./lineage-crumbs";
import { isTaxonId } from "./schema";
import { getTaxonomy } from "./server";

/** A failed lookup costs the breadcrumb its taxa, not the page; pass it on unawaited so a stall does not hold the record behind the loading screen. */
export async function loadLineageCrumbs(
  taxonId: string,
  owner: string,
): Promise<LineageCrumb[]> {
  if (!isTaxonId(taxonId)) return [];
  try {
    const taxon = await getTaxonomy(taxonId);
    return taxon ? lineageCrumbs(taxon) : [];
  } catch (error) {
    // The shared loader logs an outage once, so a cached one stays quiet here.
    if (!isUpstreamOutageError(error, upstreamServices.dataApi)) {
      console.error(`${owner}: taxonomy/${taxonId} lookup failed`, error);
    }
    return [];
  }
}
