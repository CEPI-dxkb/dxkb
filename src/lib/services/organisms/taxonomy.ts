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
    // SOLR commonly serializes longs as strings.
    if (typeof entry === "string" && entry.length > 0) {
      const numeric = Number(entry);
      if (Number.isFinite(numeric)) ids.push(numeric);
    }
  }
  return ids;
}

/**
 * Positional: a malformed rank becomes "" instead of shifting every later rank
 * onto the wrong taxon.
 */
function parseLineageRanks(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => (typeof entry === "string" ? entry : ""));
}

export class TaxonomyNotFoundError extends Error {
  constructor(public readonly taxonId: number) {
    super(`Taxon ${String(taxonId)} was not found.`);
    this.name = "TaxonomyNotFoundError";
  }
}

/**
 * Whether a failed taxonomy lookup is the service being down, not a
 * configuration error or bug, which must keep reaching the error boundary.
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
  const request: OrganismRequest = { source: `taxonomy/${String(taxonId)}` };
  const response = await fetchOrganism(`${baseUrl}/taxonomy/${String(taxonId)}`, request, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: options.signal,
  });

  if (response.status === 404) {
    throw new TaxonomyNotFoundError(taxonId);
  }

  if (!response.ok) throw await organismResponseError(response, request);

  const payload = await readJsonObject(response, request);

  return {
    taxonId: requiredNumber(payload.taxon_id ?? payload.taxonId ?? taxonId, "taxon_id"),
    taxonName: requiredString(payload.taxon_name ?? payload.taxonName, "taxon_name"),
    lineageNames: parseLineageNames(payload.lineage_names ?? payload.lineageNames),
    lineageIds: parseLineageIds(payload.lineage_ids ?? payload.lineageIds),
    lineageRanks: parseLineageRanks(payload.lineage_ranks ?? payload.lineageRanks),
    taxonRank: requiredString(payload.taxon_rank ?? payload.taxonRank, "taxon_rank"),
    genomes: numberOrNull(payload.genomes, "genomes"),
  };
}

/**
 * Fixed landing roots (Bacteria, Viruses, cellular organisms); they stand in
 * when the lookup fails, leaving only the genome count unknown.
 */
const staticLandingRoots: ReadonlyMap<number, OrganismTaxonomy> = new Map([
  [
    2,
    {
      taxonId: 2,
      taxonName: "Bacteria",
      lineageNames: ["cellular organisms", "Bacteria"],
      lineageIds: [131567, 2],
      lineageRanks: ["cellular root", "domain"],
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
      lineageRanks: ["acellular root"],
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
      lineageRanks: ["cellular root"],
      taxonRank: "no rank",
      genomes: null,
    },
  ],
]);

export function staticLandingRootTaxonomy(
  taxonId: number,
): OrganismTaxonomy | undefined {
  const root = staticLandingRoots.get(taxonId);
  return root
    ? {
        ...root,
        lineageNames: [...root.lineageNames],
        lineageIds: [...root.lineageIds],
        lineageRanks: [...(root.lineageRanks ?? [])],
      }
    : undefined;
}

/**
 * A landing root's taxonomy: the fetched record, or the static one during an
 * outage (logged); any other failure or taxon is rethrown.
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
