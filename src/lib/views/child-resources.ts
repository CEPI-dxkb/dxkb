import { genomeFeatureFields } from "@/constants/datafields/genome_feature";
import { genomeSequenceFields } from "@/constants/datafields/genome_sequence";
import { ppiFields } from "@/constants/datafields/ppi";
import { sequenceFeatureFields } from "@/constants/datafields/sequence_feature";
import type { DataFieldMap } from "@/constants/datafields/types";
import { eq } from "@/lib/data-api";

function tableColumns(fields: DataFieldMap) {
  return Object.values(fields).flatMap((field) =>
    field.show_in_table === false
      ? []
      : [{ id: field.field, label: field.label, visible: !field.hidden }],
  );
}

export const featureColumns = tableColumns(genomeFeatureFields);
export const genomeSequenceColumns = tableColumns(genomeSequenceFields);
export const interactionColumns = tableColumns(ppiFields);
export const sequenceFeatureColumns = tableColumns(sequenceFeatureFields);

export function featureDomainsRql(featureId: string): string {
  return eq("protein_feature", "feature_id", featureId);
}

export function genomeDomainsRql(genomeId: string): string {
  return eq("protein_feature", "genome_id", genomeId);
}

export function genomeFeatureRql(
  genomeId: string,
  featureType?: string,
): string {
  const genome = eq("genome_feature", "genome_id", genomeId);
  return featureType
    ? `and(${genome},${eq("genome_feature", "feature_type", featureType)})`
    : genome;
}

export function genomeProteinRql(genomeId: string): string {
  return `and(${eq("genome_feature", "genome_id", genomeId)},or(${eq("genome_feature", "feature_type", "CDS")},${eq("genome_feature", "feature_type", "mat_peptide")}),${eq("genome_feature", "annotation", "PATRIC")})`;
}

export function featureInteractionsRql(featureId: string): string {
  return `and(or(${eq("ppi", "feature_id_a", featureId)},${eq("ppi", "feature_id_b", featureId)}),${eq("ppi", "evidence", "experimental")})`;
}

export function genomeSequenceRql(genomeId: string): string {
  return eq("genome_sequence", "genome_id", genomeId);
}

export function taxonomySequenceRql(lineageClause: string): string {
  return `and(eq(genome_id,*),genome(and(${lineageClause},ne(genome_status,Deprecated))))`;
}

/**
 * Scope a child resource to every genome matching a Genome collection query, with an
 * optional extra clause on the child itself.
 */
export function genomesChildRql(genomeRql: string, extra?: string): string {
  const relationship = `genome(${genomeRql})`;
  return extra
    ? `and(eq(genome_id,*),${relationship},${extra})`
    : `and(eq(genome_id,*),${relationship})`;
}

export function genomeInteractionsRql(genomeId: string): string {
  return `and(${eq("ppi", "genome_id_a", genomeId)},${eq("ppi", "evidence", "experimental")})`;
}

export function taxonomyInteractionsRql(lineageClause: string): string {
  return `and(eq(genome_id_a,*),genome(to(genome_id_a),and(${lineageClause},ne(genome_status,Deprecated))),eq(evidence,experimental))`;
}
