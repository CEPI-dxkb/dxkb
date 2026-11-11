import { genomeScopeRql } from "./genome-scope";
import type { OrganismFetchOptions } from "./types";
import {
  fetchOrganismSolrJson,
  getBvBrcWebsiteApiBaseUrl,
  type OrganismRequest,
} from "./utils";

const genomeCountRequest: OrganismRequest = { source: "genome count" };

export interface TaxonGenomeCountOptions extends OrganismFetchOptions {
  /**
   * The signed-in user's token; their private genomes then count too and the
   * answer is not cached.
   */
  token?: string;
}

/**
 * Genomes the Taxonomy page header counts for a taxon: its lineage less
 * Deprecated genomes.
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
