import type { OrganismFetchOptions, OrganismTaxonomy } from "./types";
import {
  fetchOrganism,
  getBvBrcWebsiteApiBaseUrl,
  numberOrNull,
  readJsonObject,
  requiredNumber,
  requiredString,
  responseErrorMessage,
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
    super(`taxonomy/${String(taxonId)}: not found`);
    this.name = "TaxonomyNotFoundError";
  }
}

export async function fetchOrganismTaxonomy(
  taxonId: number,
  options: OrganismFetchOptions = {},
): Promise<OrganismTaxonomy> {
  const baseUrl = getBvBrcWebsiteApiBaseUrl();
  const response = await fetchOrganism(`${baseUrl}/taxonomy/${String(taxonId)}`, `taxonomy/${String(taxonId)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: options.signal,
  });

  if (response.status === 404) {
    throw new TaxonomyNotFoundError(taxonId);
  }

  if (!response.ok) {
    throw new Error(await responseErrorMessage(response));
  }

  const payload = await readJsonObject(response, `taxonomy/${String(taxonId)}`);

  return {
    taxonId: requiredNumber(payload.taxon_id ?? payload.taxonId ?? taxonId, "taxon_id"),
    taxonName: requiredString(payload.taxon_name ?? payload.taxonName, "taxon_name"),
    lineageNames: parseLineageNames(payload.lineage_names ?? payload.lineageNames),
    lineageIds: parseLineageIds(payload.lineage_ids ?? payload.lineageIds),
    taxonRank: requiredString(payload.taxon_rank ?? payload.taxonRank, "taxon_rank"),
    genomes: numberOrNull(payload.genomes, "genomes"),
  };
}
