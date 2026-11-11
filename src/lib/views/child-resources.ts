import { genomeSequenceFields } from "@/constants/datafields/genome_sequence";
import { ppiFields } from "@/constants/datafields/ppi";
import { sequenceFeatureFields } from "@/constants/datafields/sequence_feature";
import { eq } from "@/lib/data-api";
import type { CollectionDownloadSpec } from "@/lib/data-api/downloads";
import { deriveFieldMetadata } from "./field-metadata";

/**
 * Child tabs run through the same metadata pass, so columns carry the
 * registry's sortability; they hold their sort in state rather than the URL, so
 * only `columns` is used.
 * `genome_feature` is deliberately absent: `ResourceChildCollection`
 * substitutes the Feature profile (`feature-view/profile.ts`), which uses
 * `hiddenColumns: "omit"` where this module uses the default collapse.
 */
export const genomeSequenceColumns = deriveFieldMetadata(genomeSequenceFields, {
  resource: "genome_sequence",
}).columns;
export const interactionColumns = deriveFieldMetadata(ppiFields, {
  resource: "ppi",
}).columns;
export const sequenceFeatureColumns = deriveFieldMetadata(
  sequenceFeatureFields,
  { resource: "sequence_feature" },
).columns;

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

/**
 * Shared by the member Proteins view, the Feature list's `filter=protein` and
 * the multi-genome Proteins tab, so they all mean the same thing.
 */
const proteinFeatureClauses = [
  `or(${eq("genome_feature", "feature_type", "CDS")},${eq("genome_feature", "feature_type", "mat_peptide")})`,
  eq("genome_feature", "annotation", "PATRIC"),
];

export const proteinFeatureRql = `and(${proteinFeatureClauses.join(",")})`;

/** Legacy's ProteinList offers Protein FASTA and no DNA FASTA. */
export const proteinDownloadSpec = {
  sequenceFormats: ["protein-fasta"],
} as const satisfies CollectionDownloadSpec;

export function genomeProteinRql(genomeId: string): string {
  return `and(${eq("genome_feature", "genome_id", genomeId)},${proteinFeatureClauses.join(",")})`;
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

export function genomesChildRql(genomeRql: string, extra?: string): string {
  const relationship = `genome(${genomeRql})`;
  return extra
    ? `and(eq(genome_id,*),${relationship},${extra})`
    : `and(eq(genome_id,*),${relationship})`;
}

/**
 * A strain names its genomes in the multi-valued `genome_ids`, so the join
 * targets that field; a bare `genome(...)` with no match-all beside it is an
 * HTTP 400.
 */
export function genomeStrainsRql(genomeRql: string): string {
  return `and(eq(genome_ids,*),genome(to(genome_ids),${genomeRql}))`;
}

/**
 * A PPI row does not say which endpoint carries the scoped organism, so match
 * both sides or the tab drops every row filed B-side.
 */
export function genomeInteractionsRql(genomeId: string): string {
  return `and(or(${eq("ppi", "genome_id_a", genomeId)},${eq("ppi", "genome_id_b", genomeId)}),${eq("ppi", "evidence", "experimental")})`;
}

/**
 * Stays A-side only: the Data API RQL contract accepts only `to(genome_id_a)`
 * for `ppi` (locked by `rql.test.ts`), so there is no B-side join to `or` with.
 */
export function taxonomyInteractionsRql(lineageClause: string): string {
  return `and(eq(genome_id_a,*),genome(to(genome_id_a),and(${lineageClause},ne(genome_status,Deprecated))),eq(evidence,experimental))`;
}
