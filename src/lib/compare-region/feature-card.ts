/**
 * The feature card: a gene's hover tooltip, pinned by a click and expanded
 * with the gene's record. Here is what the comparison itself says about the
 * gene, written as `genome_feature` fields so the detail panel's sections
 * can show it before (or instead of) the record. Where the card goes is
 * `feature-popup.ts`.
 */
import type { CompareRegionFeature, CompareRegionRow } from "./contract";

/**
 * The comparison's fields for `feature` in `row`, keyed as `genome_feature`
 * fields. The card shows them at once and the Data API record replaces them
 * when it arrives; for a BLAST hit, a pseudogene or a repeat, which have no
 * record, they are all there is. `start`/`end` are the record's convention
 * (start < end on either strand), not the service's 5′/3′ ends.
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
