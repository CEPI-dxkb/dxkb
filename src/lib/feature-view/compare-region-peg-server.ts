import "server-only";

import { createServerDataRepository } from "@/lib/data-api/server-repository";
import { formatPrefixedErrorMessage } from "@/lib/utils";
import {
  compareRegionAvailability,
  compareRegionTwinRql,
  ownCompareRegionPeg,
  type CompareRegionAvailability,
} from "./compare-region-peg";
import { isPatricFeatureId, type FeatureViewRecord } from "./schema";

async function findTwinPeg(rql: string): Promise<string | null> {
  const repository = await createServerDataRepository({ readScope: "query" });
  const result = await repository.collection("genome_feature", {
    operation: "collection",
    rql,
    pageSize: 1,
    fields: ["feature_id", "patric_id"],
  });
  const peg = result.rows.at(0)?.patric_id;
  return typeof peg === "string" && isPatricFeatureId(peg) ? peg : null;
}

/**
 * The Compare Region tab's gene for a feature: its own BRC ID, else its PATRIC
 * counterpart's (one Data API read, only for a feature that lacks its own, which
 * is almost every RefSeq feature). A failed read leaves the tab off with the upstream
 * message as its reason rather than taking the whole Feature View down.
 */
export async function resolveCompareRegionAvailability(
  feature: FeatureViewRecord,
): Promise<CompareRegionAvailability> {
  const rql = ownCompareRegionPeg(feature) ? null : compareRegionTwinRql(feature);
  if (rql === null) return compareRegionAvailability(feature);
  try {
    return compareRegionAvailability(feature, await findTwinPeg(rql));
  } catch (error) {
    console.error(
      `feature/${feature.feature_id}: compare region BRC ID lookup failed:`,
      error,
    );
    return {
      peg: null,
      reason: formatPrefixedErrorMessage(
        "Could not look up this feature's BRC ID",
        error,
      ),
    };
  }
}
