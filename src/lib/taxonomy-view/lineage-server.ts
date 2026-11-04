import { lineageCrumbs, type LineageCrumb } from "./lineage-crumbs";
import { isTaxonId } from "./schema";
import { getTaxonomy } from "./server";

/**
 * The taxa that lead a record view's breadcrumb (see `lineageCrumbs`), from
 * the taxonomy record of `taxonId`, as BV-BRC's Genome and Feature Views read
 * them. The record has loaded by now, so a failed lookup costs the breadcrumb
 * its taxa, not the page; `owner` ("genome/83332.12") names the record in the
 * log. Pages pass this on unawaited and the breadcrumb streams it in, so a
 * stalled lookup does not hold the record behind the loading screen for the
 * Data API's whole budget either.
 */
export async function loadLineageCrumbs(
  taxonId: string,
  owner: string,
): Promise<LineageCrumb[]> {
  if (!isTaxonId(taxonId)) return [];
  try {
    const taxon = await getTaxonomy(taxonId);
    return taxon ? lineageCrumbs(taxon) : [];
  } catch (error) {
    console.error(`${owner}: taxonomy/${taxonId} lookup failed`, error);
    return [];
  }
}
