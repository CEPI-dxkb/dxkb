"use server";

import { forgetFailedExperimentalStructureCount } from "@/lib/services/organisms/structure-count";
import * as z from "@/lib/zod-mini";

/** The most taxon ids one tile row retries: All Organisms spans two roots. */
const maxRetryTaxa = 4;

const taxonIdsSchema = z
  .array(z.int().check(z.positive()))
  .check(z.minLength(1), z.maxLength(maxRetryTaxa));

/**
 * A stat-tile retry's server half: forgets the cached failed PDB counts of
 * the row's taxa, so the route refresh that follows loads them again instead
 * of serving the cached failure for its 60 s retry window. Only the shared
 * cache's failures are dropped (a loaded count stays, an open breaker still
 * fails fast), each taxon's at most once per 10 s, and the request and
 * session are never read: the count is public data shared by every visitor.
 * The ids come from the browser, so they are validated here.
 */
export async function forgetFailedCounts(taxonIds: unknown): Promise<void> {
  const parsed = await taxonIdsSchema.safeParseAsync(taxonIds);
  if (!parsed.success) {
    throw new Error(
      `Retry needs 1 to ${String(maxRetryTaxa)} positive integer taxon ids: ${z.prettifyError(parsed.error)}`,
    );
  }
  for (const taxonId of new Set(parsed.data)) {
    forgetFailedExperimentalStructureCount(taxonId);
  }
}
