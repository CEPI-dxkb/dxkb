import "server-only";

import { cache } from "react";

import {
  upstreamServices,
  upstreamTimeoutMs,
} from "@/lib/api/upstream-failure";
import {
  isUpstreamDown,
  isUpstreamOutageError,
} from "@/lib/api/upstream-outage";
import { createServerDataRepository } from "@/lib/data-api/server-repository";
import { createSharedCache } from "@/lib/shared-cache";

import { taxonomyViewRecordSchema, type TaxonomyViewRecord } from "./schema";

/** Logs an outage once per failed load; a cached failure is served unlogged. */
async function loadTaxonomyRecord(
  taxonId: string,
): Promise<TaxonomyViewRecord | null> {
  try {
    const repository = await createServerDataRepository({
      readScope: "member",
      anonymous: true,
    });
    const result = await repository.member("taxonomy", {
      operation: "member",
      id: taxonId,
    });
    return result.row ? taxonomyViewRecordSchema.parse(result.row) : null;
  } catch (error) {
    if (isUpstreamOutageError(error, upstreamServices.dataApi)) {
      console.error(`taxonomy/${taxonId}: taxonomy lookup failed`, error);
    }
    throw error;
  }
}

// Read anonymously because every visitor shares the result; this relies on
// taxonomy rows being public. A missing row is rechecked after a minute
// because a new taxon may appear.
const taxonomyRecordCache = createSharedCache<
  string,
  TaxonomyViewRecord | null
>({
  name: "taxonomy-record",
  load: (taxonId) => loadTaxonomyRecord(taxonId),
  freshMs: (row) => (row === null ? 60_000 : 60 * 60 * 1000),
  retryMs: 60_000,
  maxEntries: 5000,
  cacheError: (error) => isUpstreamOutageError(error, upstreamServices.dataApi),
  breaker: {
    trips: (error, elapsedMs) =>
      isUpstreamDown(error, upstreamServices.dataApi, {
        elapsedMs,
        budgetMs: upstreamTimeoutMs.dataApi,
      }),
  },
});

/** A cached row or failure is the same object for every visitor; do not mutate it. */
export const getTaxonomy = cache(
  (taxonId: string): Promise<TaxonomyViewRecord | null> =>
    taxonomyRecordCache.get(taxonId),
);
