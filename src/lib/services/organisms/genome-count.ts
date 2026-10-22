import { genomeScopeRql } from "./genome-scope";
import type { OrganismFetchOptions } from "./types";
import {
  fetchOrganismSolrJson,
  getBvBrcWebsiteApiBaseUrl,
  type OrganismRequest,
} from "./utils";

// Unlabelled: the count is a header decoration that is left out when it fails;
// the label only reaches the server log.
const genomeCountRequest: OrganismRequest = { source: "genome count" };

export interface TaxonGenomeCountOptions extends OrganismFetchOptions {
  /**
   * The signed-in user's token. Their private genomes then count too, as in
   * legacy's header and this page's Genomes tab, and the answer is not cached.
   */
  token?: string;
}

/**
 * How many genomes the Taxonomy page's header counts for a taxon: its lineage
 * less Deprecated genomes, as legacy's "(N Genomes)" counts them. The taxonomy
 * record's own `genomes` field counts the Deprecated ones as well.
 */
export async function fetchTaxonGenomeCount(
  taxonId: number,
  options: TaxonGenomeCountOptions = {},
): Promise<number> {
  const baseUrl = getBvBrcWebsiteApiBaseUrl();
  const payload = await fetchOrganismSolrJson(
    `${baseUrl}/genome/?${genomeScopeRql(taxonId)}&select(genome_id)&limit(1)`,
    genomeCountRequest,
    options.signal,
    options.token,
  );
  const response = payload.response as { numFound?: unknown } | undefined;
  const numFound = response?.numFound;
  if (typeof numFound !== "number" || !Number.isFinite(numFound)) {
    throw new Error("Unexpected SOLR response shape — missing response.numFound");
  }
  return numFound;
}
