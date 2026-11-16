import type { OrganismFetchOptions, OrganismSummary } from "./types";
import {
  fetchOrganism,
  getBvBrcWebsiteApiBaseUrl,
  numberOrNull,
  organismResponseError,
  readJsonObject,
  type OrganismRequest,
} from "./utils";

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

function sumNullable(values: (number | null)[]): number | null {
  const numbers = values.filter((value) => value !== null);
  if (numbers.length === 0) return null;
  return numbers.reduce((total, value) => total + value, 0);
}

/**
 * The summary of several taxon roots added together, for a landing page that
 * spans roots no single taxon id covers (All Organisms: cellular organisms and
 * Viruses). `summary_by_taxon` takes one id and no OR expression, so each root
 * is fetched on its own. A root that fails rejects the whole call with its
 * original error: a partial sum would pass for the real count.
 *
 * The roots' genome sets are disjoint, so the counts add. The unique-name
 * fields overcount by about 2: the placeholder names `""` and `"null"` appear
 * under both roots. A field is `null` only when every root's value is `null`
 * (the API leaves out a `unique_*` field when it is 1, and `CDS` or
 * `mat_peptide` when it is 0).
 */
export async function fetchCombinedOrganismSummary(
  taxonIds: readonly number[],
  options: OrganismFetchOptions = {},
): Promise<OrganismSummary> {
  if (taxonIds.length === 0) {
    throw new Error("Combined organism summaries need at least one taxon id.");
  }

  const summaries = await Promise.all(
    taxonIds.map((taxonId) => fetchOrganismSummary(taxonId, options)),
  );

  return {
    count: sumNullable(summaries.map((summary) => summary.count)),
    uniqueFamily: sumNullable(summaries.map((summary) => summary.uniqueFamily)),
    uniqueGenus: sumNullable(summaries.map((summary) => summary.uniqueGenus)),
    uniqueSpecies: sumNullable(summaries.map((summary) => summary.uniqueSpecies)),
    cds: sumNullable(summaries.map((summary) => summary.cds)),
    matPeptide: sumNullable(summaries.map((summary) => summary.matPeptide)),
    pdb: sumNullable(summaries.map((summary) => summary.pdb)),
  };
}
