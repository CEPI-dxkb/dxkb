import type { OrganismFetchOptions } from "./types";
import {
  fetchOrganismSolrJson,
  getBvBrcWebsiteApiBaseUrl,
  type OrganismRequest,
} from "./utils";

const structureCountRequest: OrganismRequest = {
  source: "protein_structure count",
};

/**
 * A taxon's experimentally determined structures. `protein_structure` also
 * holds the AlphaFold models (`method=Predicted`, ~99.7% of the collection),
 * which `summary_by_taxon`'s `PDB` counts too; they are not PDB entries.
 */
export function experimentalStructureRql(taxonId: number): string {
  return `and(eq(taxon_lineage_ids,${String(taxonId)}),ne(method,Predicted))`;
}

export async function fetchExperimentalStructureCount(
  taxonId: number,
  options: OrganismFetchOptions = {},
): Promise<number> {
  const baseUrl = getBvBrcWebsiteApiBaseUrl();
  const payload = await fetchOrganismSolrJson(
    `${baseUrl}/protein_structure/?${experimentalStructureRql(taxonId)}&limit(1)`,
    structureCountRequest,
    options.signal,
  );
  const response = payload.response as { numFound?: unknown } | undefined;
  const numFound = response?.numFound;
  if (typeof numFound !== "number" || !Number.isFinite(numFound)) {
    throw new Error("Unexpected SOLR response shape — missing response.numFound");
  }
  return numFound;
}
