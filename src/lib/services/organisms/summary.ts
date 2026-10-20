import type { OrganismFetchOptions, OrganismSummary } from "./types";
import {
  fetchOrganism,
  getBvBrcWebsiteApiBaseUrl,
  numberOrNull,
  organismResponseError,
  readJsonObject,
  type OrganismRequest,
} from "./utils";

// Unlabelled: each place that shows the summary names it ("Data summary could
// not be loaded", "Taxon counts could not be loaded: …").
const summaryRequest: OrganismRequest = { source: "summary_by_taxon" };

export async function fetchOrganismSummary(
  taxonId: number,
  options: OrganismFetchOptions = {},
): Promise<OrganismSummary> {
  const baseUrl = getBvBrcWebsiteApiBaseUrl();
  const response = await fetchOrganism(`${baseUrl}/data/summary_by_taxon/${String(taxonId)}`, summaryRequest, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: options.signal,
  });

  if (!response.ok) throw await organismResponseError(response, summaryRequest);

  const payload = await readJsonObject(response, summaryRequest);

  return {
    count: numberOrNull(payload.count, "count"),
    uniqueFamily: numberOrNull(payload.unique_family, "unique_family"),
    uniqueGenus: numberOrNull(payload.unique_genus, "unique_genus"),
    uniqueSpecies: numberOrNull(payload.unique_species, "unique_species"),
    cds: numberOrNull(payload.CDS, "CDS"),
    matPeptide: numberOrNull(payload.mat_peptide, "mat_peptide"),
    pdb: numberOrNull(payload.PDB, "PDB"),
  };
}
