import { genomeScopeRql } from "./genome-scope";
import type { OrganismFetchOptions } from "./types";
import {
  fetchOrganismSolrJson,
  getBvBrcWebsiteApiBaseUrl,
  organismJoinFetchTimeoutMs,
  type OrganismRequest,
} from "./utils";

const structureCountRequest: OrganismRequest = {
  source: "protein_structure count",
};

/**
 * A taxon's experimentally determined structures, counted the way the Protein
 * Structures tab lists them: every non-predicted `protein_structure` linked to
 * a non-Deprecated genome of the taxon's lineage. `protein_structure` also
 * holds the AlphaFold models (`method=Predicted`, ~99.7% of the collection),
 * which `summary_by_taxon`'s `PDB` counts too; they are not PDB entries.
 *
 * The count used to filter by the structure's own `taxon_lineage_ids`, which is
 * empty or stale on many documents (Bunyaviricetes 0 against the tab's 257 on
 * 2026-11-19), so the tile disagreed with the tab it links to. The genome join
 * is slow, about 23 s for Bacteria, so a caller should reach it through the
 * shared cache rather than per request.
 */
export function experimentalStructureRql(taxonId: number): string {
  return `and(ne(method,Predicted),eq(genome_id,*),genome(${genomeScopeRql(taxonId)}))`;
}

export async function fetchExperimentalStructureCount(
  taxonId: number,
  options: OrganismFetchOptions = {},
): Promise<number> {
  const baseUrl = getBvBrcWebsiteApiBaseUrl();
  const payload = await fetchOrganismSolrJson(
    `${baseUrl}/protein_structure/?${experimentalStructureRql(taxonId)}&limit(1)&select(pdb_id)`,
    structureCountRequest,
    options.signal,
    undefined,
    organismJoinFetchTimeoutMs,
  );
  const response = payload.response as { numFound?: unknown } | undefined;
  const numFound = response?.numFound;
  if (typeof numFound !== "number" || !Number.isFinite(numFound)) {
    throw new Error("Unexpected SOLR response shape — missing response.numFound");
  }
  return numFound;
}
