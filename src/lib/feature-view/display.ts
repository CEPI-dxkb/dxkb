import type { FastaTypeFor } from "@/lib/data-api/fasta";
import type { FeatureViewRecord } from "./schema";

/** The identifier users recognize a feature by; `feature_id` (the Solr key) is the last resort. Blank counts as absent. */
export function featureDisplayName(feature: FeatureViewRecord): string {
  return (
    [feature.patric_id, feature.refseq_locus_tag, feature.protein_id].find(
      (id): id is string => Boolean(id?.trim()),
    ) ?? feature.feature_id
  );
}

/** BV-BRC's Feature View lines under the breadcrumb: BRC ID, RefSeq locus tag, gene, product; `name` is the heading, `details` the non-blank rest. */
export function featureHeaderParts(feature: FeatureViewRecord): {
  name: string;
  details: string[];
} {
  const name = featureDisplayName(feature);
  const details = [feature.refseq_locus_tag, feature.gene, feature.product]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value) && value !== name);
  return { name, details };
}

function hasLength(value: FeatureViewRecord["na_length"]): boolean {
  return Number(value) > 0;
}

/** FASTA flavours the feature can produce; protein only when the record has an amino-acid sequence. */
export function featureFastaTypes(
  feature: FeatureViewRecord,
): FastaTypeFor<"genome_feature">[] {
  const types: FastaTypeFor<"genome_feature">[] = [];
  if (hasLength(feature.na_length) || feature.na_sequence_md5) types.push("dna");
  if (hasLength(feature.aa_length) || feature.aa_sequence_md5)
    types.push("protein");
  return types;
}
