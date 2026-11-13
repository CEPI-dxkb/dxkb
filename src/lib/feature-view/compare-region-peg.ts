import { escapeRqlValue } from "@/lib/views/rql";
import { isPatricFeatureId, type FeatureViewRecord } from "./schema";

export const compareRegionNoBrcIdReason =
  "This feature has no BRC ID (PATRIC annotation), which the Compare Region Viewer needs.";

/** What the Compare Region tab needs: the gene's BRC ID, or the reason there is none. */
export type CompareRegionAvailability =
  | { peg: string; reason?: undefined }
  | { peg: null; reason: string };

/** The genome id inside a `fig|<genome_id>.<type>.<n>` BRC ID, or null. */
export function patricIdGenomeId(patricId: string): string | null {
  return /^fig\|(\d+\.\d+)\.[^.]+\.\d+/.exec(patricId)?.[1] ?? null;
}

/**
 * The BRC ID the Compare Region Viewer centers on when the feature carries one,
 * whatever its type: the service answers every PATRIC `fig|` id. A CDS compares
 * across genomes; any other type gets its own neighbourhood only. About 657,000
 * RefSeq CDS carry a BRC ID of another genome, which the service answers with a
 * row that never names the pinned gene, so those are refused.
 */
export function ownCompareRegionPeg(feature: FeatureViewRecord): string | null {
  const peg = feature.patric_id;
  if (!peg || !isPatricFeatureId(peg)) return null;
  const genomeId = patricIdGenomeId(peg);
  if (feature.genome_id && genomeId && genomeId !== feature.genome_id) {
    return null;
  }
  return peg;
}

const strandLiterals: Record<string, string> = {
  "+": "%22%2B%22",
  "-": "%22-%22",
};

/** PATRIC has no `gene` type: a RefSeq gene's counterpart is its CDS. */
function twinFeatureType(featureType: string | undefined): string | null {
  if (!featureType) return null;
  return featureType === "gene" ? "CDS" : featureType;
}

/**
 * Legacy BV-BRC's `redirectToPATRICFeature` looked a non-PATRIC feature's PATRIC
 * counterpart up by sequence, end and strand (the end, not the start, because
 * the two annotations can start a gene at different codons). The type is added
 * so a viral mat_peptide, which shares its end with its polyprotein CDS, finds
 * its own twin. The genome is added when the feature names one, because an
 * accession such as NC_000913 recurs across many genome records and the first
 * row of another genome would pin the wrong gene. Null when the feature is
 * already PATRIC or lacks a location or type.
 */
export function compareRegionTwinRql(feature: FeatureViewRecord): string | null {
  if (feature.annotation === "PATRIC") return null;
  const type = twinFeatureType(feature.feature_type);
  const { sequence_id: sequenceId, end, strand } = feature;
  const strandLiteral = strand === undefined ? undefined : strandLiterals[strand];
  if (!type || !sequenceId || end === undefined || end === "" || !strandLiteral) {
    return null;
  }
  const genomeClause = feature.genome_id
    ? `eq(genome_id,${escapeRqlValue(feature.genome_id)}),`
    : "";
  return `and(eq(annotation,PATRIC),${genomeClause}eq(feature_type,${escapeRqlValue(type)}),eq(sequence_id,${escapeRqlValue(sequenceId)}),eq(end,${escapeRqlValue(String(end))}),eq(strand,${strandLiteral}))`;
}

/** A twin only matters when the feature has no usable BRC ID of its own. */
export function compareRegionAvailability(
  feature: FeatureViewRecord,
  twinPeg: string | null = null,
): CompareRegionAvailability {
  const peg = ownCompareRegionPeg(feature) ?? twinPeg;
  return peg ? { peg } : { peg: null, reason: compareRegionNoBrcIdReason };
}
