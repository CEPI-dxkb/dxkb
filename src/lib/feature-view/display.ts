import type { FastaTypeFor } from "@/lib/data-api/fasta";
import type { FeatureViewRecord } from "./schema";

/**
 * The identifier a person recognizes a feature by. `feature_id`
 * (`PATRIC.644340.17.JAEUGC010000001.CDS.12314.12580.rev`) is the Solr key —
 * it addresses the page but is never how a user names a gene — so it is the
 * last resort, for a record that carries none of the public identifiers. A
 * blank identifier counts as absent, or it would title the page with nothing.
 */
export function featureDisplayName(feature: FeatureViewRecord): string {
  return (
    [feature.patric_id, feature.refseq_locus_tag, feature.protein_id].find(
      (id): id is string => Boolean(id?.trim()),
    ) ?? feature.feature_id
  );
}

function hasLength(value: FeatureViewRecord["na_length"]): boolean {
  return Number(value) > 0;
}

/**
 * The FASTA flavours this feature can actually produce. Offering a protein
 * download for an RNA or other untranslated feature would only ever return an
 * empty file, so it is offered when the record has an amino-acid sequence.
 */
export function featureFastaTypes(
  feature: FeatureViewRecord,
): FastaTypeFor<"genome_feature">[] {
  const types: FastaTypeFor<"genome_feature">[] = [];
  if (hasLength(feature.na_length) || feature.na_sequence_md5) types.push("dna");
  if (hasLength(feature.aa_length) || feature.aa_sequence_md5)
    types.push("protein");
  return types;
}
