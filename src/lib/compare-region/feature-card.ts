import type { CompareRegionFeature, CompareRegionRow } from "./contract";

/**
 * `start`/`end` follow the record's convention (start < end on either strand),
 * not the service's 5′/3′ ends.
 */
export function featureStandIn(
  feature: CompareRegionFeature,
  row: CompareRegionRow,
): Record<string, unknown> {
  const familyField = feature.familyId?.startsWith("PLF_")
    ? "plfam_id"
    : "pgfam_id";
  return {
    patric_id: feature.fid,
    genome_id: row.genomeId,
    genome_name: row.genomeName,
    start: Math.min(feature.start, feature.end),
    end: Math.max(feature.start, feature.end),
    strand: feature.strand ?? undefined,
    product: feature.product || undefined,
    ...(feature.familyId ? { [familyField]: feature.familyId } : {}),
  };
}
