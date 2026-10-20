import {
  describeUpstreamFailure,
  upstreamServices,
} from "@/lib/api/upstream-failure";

import type { OrganismFetchOptions, OrganismTaxonomy } from "./types";
import {
  fetchOrganism,
  getBvBrcWebsiteApiBaseUrl,
  numberOrNull,
  organismResponseError,
  readJsonObject,
  requiredNumber,
  requiredString,
  type OrganismRequest,
} from "./utils";

function parseLineageNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function parseLineageIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const ids: number[] = [];
  for (const entry of value) {
    if (typeof entry === "number" && Number.isFinite(entry)) {
      ids.push(entry);
      continue;
    }
    // SOLR with `application/solr+json` commonly serializes longs as strings.
    if (typeof entry === "string" && entry.length > 0) {
      const numeric = Number(entry);
      if (Number.isFinite(numeric)) ids.push(numeric);
    }
  }
  return ids;
}

export class TaxonomyNotFoundError extends Error {
  constructor(public readonly taxonId: number) {
    super(`Taxon ${String(taxonId)} was not found.`);
    this.name = "TaxonomyNotFoundError";
  }
}

/**
 * Whether a failed taxonomy lookup is the service being down (a 5xx answer, a
 * timeout, an unreachable host) rather than a configuration error, a malformed
 * payload or a bug, which must keep reaching the error boundary and the log.
 */
export function isTaxonomyOutage(error: unknown): boolean {
  const failure = describeUpstreamFailure(error, upstreamServices.dataApi);
  return failure !== null && failure.status >= 500;
}

export async function fetchOrganismTaxonomy(
  taxonId: number,
  options: OrganismFetchOptions = {},
): Promise<OrganismTaxonomy> {
  const baseUrl = getBvBrcWebsiteApiBaseUrl();
  // Unlabelled: the page showing a failure names the taxon ("Taxon 234 could
  // not be loaded").
  const request: OrganismRequest = { source: `taxonomy/${String(taxonId)}` };
  const response = await fetchOrganism(`${baseUrl}/taxonomy/${String(taxonId)}`, request, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: options.signal,
  });

  if (response.status === 404) {
    throw new TaxonomyNotFoundError(taxonId);
  }

  // The UpstreamError carries the status, so a page can tell a 5xx (the
  // service failing, not this request) from a bug.
  if (!response.ok) throw await organismResponseError(response, request);

  const payload = await readJsonObject(response, request);

  return {
    taxonId: requiredNumber(payload.taxon_id ?? payload.taxonId ?? taxonId, "taxon_id"),
    taxonName: requiredString(payload.taxon_name ?? payload.taxonName, "taxon_name"),
    lineageNames: parseLineageNames(payload.lineage_names ?? payload.lineageNames),
    lineageIds: parseLineageIds(payload.lineage_ids ?? payload.lineageIds),
    taxonRank: requiredString(payload.taxon_rank ?? payload.taxonRank, "taxon_rank"),
    genomes: numberOrNull(payload.genomes, "genomes"),
  };
}

/**
 * The fixed roots of the organism landing pages (Bacteria, Viruses, cellular
 * organisms), as BV-BRC's taxonomy endpoint returns them. These NCBI roots and
 * their lineages do not change, and a landing's tabs and scope need only the
 * id and lineage, so they stand in when the lookup fails; only the genome
 * count (`genomes`, shown on the Taxa Tree root row) is then unknown.
 */
const staticLandingRoots: ReadonlyMap<number, OrganismTaxonomy> = new Map([
  [
    2,
    {
      taxonId: 2,
      taxonName: "Bacteria",
      lineageNames: ["cellular organisms", "Bacteria"],
      lineageIds: [131567, 2],
      taxonRank: "superkingdom",
      genomes: null,
    },
  ],
  [
    10239,
    {
      taxonId: 10239,
      taxonName: "Viruses",
      lineageNames: ["Viruses"],
      lineageIds: [10239],
      taxonRank: "superkingdom",
      genomes: null,
    },
  ],
  [
    131567,
    {
      taxonId: 131567,
      taxonName: "cellular organisms",
      lineageNames: ["cellular organisms"],
      lineageIds: [131567],
      taxonRank: "no rank",
      genomes: null,
    },
  ],
]);

/** A copy of a landing root's static taxonomy, or `undefined` for any other taxon. */
export function staticLandingRootTaxonomy(
  taxonId: number,
): OrganismTaxonomy | undefined {
  const root = staticLandingRoots.get(taxonId);
  return root
    ? { ...root, lineageNames: [...root.lineageNames], lineageIds: [...root.lineageIds] }
    : undefined;
}

/**
 * A landing root's taxonomy: the fetched record, or the static one when the
 * service is down (`isTaxonomyOutage`), so a landing's shell, rail and static
 * sections render during an outage and only its data sections (each behind its
 * own section error) fail. The outage is logged, since nothing on the page
 * reports it. Any other failure (a missing env var, a malformed payload) and
 * any taxon that is not a landing root is rethrown.
 */
export async function fetchLandingRootTaxonomy(
  taxonId: number,
  options: OrganismFetchOptions = {},
): Promise<OrganismTaxonomy> {
  try {
    return await fetchOrganismTaxonomy(taxonId, options);
  } catch (error) {
    const fallback = staticLandingRootTaxonomy(taxonId);
    if (!fallback || !isTaxonomyOutage(error)) throw error;
    console.error(
      `taxonomy/${String(taxonId)}: lookup failed, using the static landing root`,
      error,
    );
    return fallback;
  }
}
