import "server-only";

import type { OrganismViewKey } from "@/components/organisms/types";
import { taxonIdsLineageClause } from "@/components/organisms/taxon-views/scope";
import {
  upstreamServices,
  upstreamTimeoutMs,
} from "@/lib/api/upstream-failure";
import {
  isUpstreamDown,
  isUpstreamOutageError,
} from "@/lib/api/upstream-outage";
import type { DataApiMultiQuery } from "@/lib/data-api/repository";
import { getResourceDefinition } from "@/lib/data-api/resources";
import { createServerDataRepository } from "@/lib/data-api/server-repository";
import { createSharedCache } from "@/lib/shared-cache";

import type { TabAvailability } from "./tab-context";

/**
 * The tabs whose "has data" is one cheap count on the tab's own resource and
 * its own clause (`taxonLineageClause(scope)`: `eq(taxon_lineage_ids,<id>)`).
 * Genome-joined tabs are left out on purpose: their join scales with the
 * taxon's genome count, so a `limit(1)` can take minutes.
 */
const availabilityProbes: readonly {
  key: OrganismViewKey;
  dataType: string;
}[] = [
  { key: "epitopes", dataType: "epitope" },
  { key: "experiments", dataType: "experiment" },
  { key: "strains", dataType: "strain" },
  { key: "surveillance", dataType: "surveillance" },
  { key: "serology", dataType: "serology" },
];

export function tabAvailabilityQueries(
  taxonId: number,
): Record<string, DataApiMultiQuery> {
  const lineageClause = taxonIdsLineageClause([taxonId]);
  return Object.fromEntries(
    availabilityProbes.map(({ key, dataType }) => [
      key,
      {
        dataType,
        accept: "application/solr+json",
        query: `${lineageClause}&select(${getResourceDefinition(dataType).idField})&limit(1)`,
      },
    ]),
  );
}

function numFoundOf(entry: unknown): number | null {
  const response = (
    entry as
      | { result?: { response?: { numFound?: unknown } } }
      | null
      | undefined
  )?.result?.response;
  return typeof response?.numFound === "number" ? response.numFound : null;
}

export function parseTabAvailability(
  payload: Record<string, unknown>,
): TabAvailability {
  const availability: TabAvailability = {};
  for (const { key } of availabilityProbes) {
    const numFound = numFoundOf(payload[key]);
    availability[key] =
      numFound === null ? "unknown" : numFound > 0 ? "present" : "absent";
  }
  return availability;
}

/** Logs an outage once per failed load; a cached failure is served unlogged. */
async function loadTabAvailability(taxonId: number): Promise<TabAvailability> {
  try {
    const repository = await createServerDataRepository({
      readScope: "query",
      anonymous: true,
      bypassDataCache: true,
    });
    const payload = await repository.multiQuery(
      tabAvailabilityQueries(taxonId),
      undefined,
      upstreamTimeoutMs.dataApiTabAvailability,
    );
    return parseTabAvailability(payload);
  } catch (error) {
    if (isUpstreamOutageError(error, upstreamServices.dataApi)) {
      console.error(
        `taxonomy/${String(taxonId)}: tab availability failed`,
        error,
      );
    }
    throw error;
  }
}

// Public data that changes with the nightly loads, read anonymously because
// every visitor shares the result. An outage (including the 5 s budget running
// out) is cached for the retry window so visitors do not each wait for it; a
// malformed payload parses to `unknown` per tab and is not an error.
const tabAvailabilityCache = createSharedCache<number, TabAvailability>({
  name: "taxon-tab-availability",
  load: (taxonId) => loadTabAvailability(taxonId),
  freshMs: 60 * 60 * 1000,
  retryMs: 60_000,
  maxEntries: 5000,
  cacheError: (error) => isUpstreamOutageError(error, upstreamServices.dataApi),
  breaker: {
    trips: (error, elapsedMs) =>
      isUpstreamDown(error, upstreamServices.dataApi, {
        elapsedMs,
        budgetMs: upstreamTimeoutMs.dataApiTabAvailability,
      }),
  },
});

/**
 * A taxon's per-tab availability, or `null` when the read failed: the caller
 * then leaves every tab enabled. Never rejects, so a stream of it cannot break
 * the page. An outage is logged once by the loader; any other failure (a kept
 * 401/403/404/429, a missing `DATA_API_URL`, a bug) is logged here, because the
 * cache does not cache it and logs a non-cacheable failure only on a background
 * refresh, so the feature would otherwise switch off without a trace.
 */
export async function getSharedTabAvailability(
  taxonId: number,
): Promise<TabAvailability | null> {
  try {
    return await tabAvailabilityCache.get(taxonId);
  } catch (error) {
    if (!isUpstreamOutageError(error, upstreamServices.dataApi)) {
      console.error(
        `taxonomy/${String(taxonId)}: tab availability failed`,
        error,
      );
    }
    return null;
  }
}
