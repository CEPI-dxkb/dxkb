import { getSharedExperimentalStructureCount } from "./structure-count";
import type {
  CountResult,
  OrganismFetchOptions,
  OrganismSummary,
} from "./types";
import {
  fetchOrganism,
  getBvBrcWebsiteApiBaseUrl,
  numberOrNull,
  organismResponseError,
  readJsonObject,
  type OrganismRequest,
} from "./utils";

const summaryRequest: OrganismRequest = { source: "summary_by_taxon" };

async function fetchSummaryPayload(
  taxonId: number,
  options: OrganismFetchOptions,
): Promise<Record<string, unknown>> {
  const baseUrl = getBvBrcWebsiteApiBaseUrl();
  const response = await fetchOrganism(`${baseUrl}/data/summary_by_taxon/${String(taxonId)}`, summaryRequest, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: options.signal,
  });

  if (!response.ok) throw await organismResponseError(response, summaryRequest);

  return readJsonObject(response, summaryRequest);
}

/** Settles a count into a `CountResult`, so its failure travels beside the other counts instead of rejecting them. */
function settleCount(promise: Promise<number>): Promise<CountResult> {
  return promise.then(
    (value): CountResult => ({ status: "fulfilled", value }),
    (reason: unknown): CountResult => ({ status: "rejected", reason }),
  );
}

/**
 * `summary_by_taxon` supplies everything but `pdb`; `pdb` is the
 * experimental-structure count the Protein Structures tab shows (a genome
 * join, see `structure-count.ts`), read through the shared cache because the
 * join takes about 23 s for Bacteria. Only a failed summary request rejects:
 * `pdb` is settled on its own and carries its own failure, with its original
 * message, so a slow or failed join leaves only the PDB tile Unavailable.
 * `options.signal` cancels only the summary request: the shared count load
 * serves every visitor, so one caller's cancellation cannot stop it.
 */
export async function fetchOrganismSummary(
  taxonId: number,
  options: OrganismFetchOptions = {},
): Promise<OrganismSummary> {
  const [payload, pdb] = await Promise.all([
    fetchSummaryPayload(taxonId, options),
    settleCount(getSharedExperimentalStructureCount(taxonId)),
  ]);

  return {
    count: numberOrNull(payload.count, "count"),
    uniqueFamily: numberOrNull(payload.unique_family, "unique_family"),
    uniqueGenus: numberOrNull(payload.unique_genus, "unique_genus"),
    uniqueSpecies: numberOrNull(payload.unique_species, "unique_species"),
    cds: numberOrNull(payload.CDS, "CDS"),
    matPeptide: numberOrNull(payload.mat_peptide, "mat_peptide"),
    pdb,
  };
}

/** The sum, or `null` when every value is `null` (an omitted field is 0 or 1). */
function sumNullable(values: (number | null)[]): number | null {
  const numbers = values.filter((value) => value !== null);
  if (numbers.length === 0) return null;
  return numbers.reduce((total, value) => total + value, 0);
}

/** The sum, or `null` when any value is `null`: a partial sum is not the total. */
function sumStrict(values: (number | null)[]): number | null {
  const numbers = values.filter((value) => value !== null);
  if (numbers.length < values.length) return null;
  return numbers.reduce((total, value) => total + value, 0);
}

/** The sum, or the first failed root's result: a partial sum would pass for the real count. */
function sumCountResults(results: CountResult[]): CountResult {
  let total = 0;
  for (const result of results) {
    if (result.status === "rejected") return result;
    total += result.value;
  }
  return { status: "fulfilled", value: total };
}

/**
 * The summary of several taxon roots added together, for a landing page that
 * spans roots no single taxon id covers (All Organisms: cellular organisms and
 * Viruses). `summary_by_taxon` takes one id and no OR expression, so each root
 * is fetched on its own. A root whose summary fails rejects the whole call
 * with its original error: a partial sum would pass for the real count. A
 * root whose structure count fails makes `pdb` that root's failure, for the
 * same reason, while the other fields still sum.
 *
 * The roots' genome sets are disjoint, so the counts add. The unique-name
 * fields overcount by about 2: the placeholder names `""` and `"null"` appear
 * under both roots. `count` is `null` when any root's count is `null`: a total
 * from the other roots alone would pass for the real one. Every other field is
 * `null` only when every root's value is `null`, because the API leaves out a
 * `unique_*` field when it is 1, and `CDS` or `mat_peptide` when it is 0. A
 * root that omits a `unique_*` field therefore makes that sum low by at most 1
 * per omitting root, which is acceptable for the real roots.
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
    count: sumStrict(summaries.map((summary) => summary.count)),
    uniqueFamily: sumNullable(summaries.map((summary) => summary.uniqueFamily)),
    uniqueGenus: sumNullable(summaries.map((summary) => summary.uniqueGenus)),
    uniqueSpecies: sumNullable(summaries.map((summary) => summary.uniqueSpecies)),
    cds: sumNullable(summaries.map((summary) => summary.cds)),
    matPeptide: sumNullable(summaries.map((summary) => summary.matPeptide)),
    pdb: sumCountResults(summaries.map((summary) => summary.pdb)),
  };
}
