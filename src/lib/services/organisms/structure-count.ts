import "server-only";

import { upstreamServices } from "@/lib/api/upstream-failure";
import { isUpstreamDown } from "@/lib/api/upstream-outage";
import { createSharedCache } from "@/lib/shared-cache";

import { genomeScopeRql } from "./genome-scope";
import type { OrganismFetchOptions } from "./types";
import {
  fetchOrganismSolrJson,
  getBvBrcWebsiteApiBaseUrl,
  isOrganismDataOutage,
  organismJoinFetchTimeoutMs,
  type OrganismRequest,
} from "./utils";

const structureCountRequest: OrganismRequest = {
  source: "protein_structure count",
  label: "PDB structures",
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

/** Logs an outage once per failed load; a cached failure is served unlogged. */
async function loadExperimentalStructureCount(taxonId: number): Promise<number> {
  try {
    return await fetchExperimentalStructureCount(taxonId);
  } catch (error) {
    if (isOrganismDataOutage(error)) {
      console.error(`protein-structure-count/${String(taxonId)}: count failed`, error);
    }
    throw error;
  }
}

// The count is public data that changes with the nightly loads, so one join
// per taxon a day is enough. Its fetch also goes through Next's data cache
// (`fetchOrganism`, revalidated every 86400 s), so a refresh at 24 h can read
// a data-cache entry that is itself about a day old and store it as fresh:
// the tile can lag the live tab by up to about two days of new structures.
// An outage (including the 60 s budget running out) is cached for the retry
// window so visitors do not each wait for the join again; a malformed payload
// or a missing env var is not cached.
const experimentalStructureCountCache = createSharedCache<number, number>({
  name: "organism-experimental-structure-count",
  load: (taxonId) => loadExperimentalStructureCount(taxonId),
  freshMs: 24 * 60 * 60 * 1000,
  retryMs: 60_000,
  maxEntries: 2000,
  cacheError: isOrganismDataOutage,
  // One pair of cold timeouts can open the breaker for every uncached taxon:
  // All Organisms starts two root joins at once, and two cold timeouts within
  // 60 s open it for 30 s (cached values keep serving). Only the PDB tiles
  // are affected, because the summary settles this count on its own, so
  // timeouts stay in `trips`.
  breaker: {
    trips: (error, elapsedMs) =>
      isUpstreamDown(error, upstreamServices.dataApi, {
        elapsedMs,
        budgetMs: organismJoinFetchTimeoutMs,
      }),
  },
});

/**
 * `fetchExperimentalStructureCount` through the process-wide cache, sent
 * without a token or a request signal. A cached failure is the same error
 * object for every visitor, so callers must not mutate it.
 */
export function getSharedExperimentalStructureCount(taxonId: number): Promise<number> {
  return experimentalStructureCountCache.get(taxonId);
}

/**
 * Drops a taxon's cached failed count so the next read joins it again, for a
 * user's retry of the PDB tile (at most once per 10 s per taxon; a cached
 * count and an open breaker are left alone). Returns whether it forgot one.
 */
export function forgetFailedExperimentalStructureCount(taxonId: number): boolean {
  return experimentalStructureCountCache.forgetFailure(taxonId);
}
