import { genomeSequenceFields } from "@/constants/datafields/genome_sequence";
import { ppiFields } from "@/constants/datafields/ppi";
import { sequenceFeatureFields } from "@/constants/datafields/sequence_feature";
import { eq } from "@/lib/data-api";
import { deriveFieldMetadata } from "./field-metadata";

/**
 * Child tabs run through the same metadata pass as the top-level collections, so a child
 * column carries the registry's sortability too. Before that, child columns omitted
 * `sortable` entirely, which `DataTable` reads as "sortable" — a header for a field the
 * Data API rejects. Child tabs hold their sort in component state rather than the URL, so
 * they consume `columns` only; the other three derived outputs stay unused here.
 *
 * Only the three child resources with no `src/lib/*-view/` directory of their own live
 * here. `genome_feature` deliberately does not: `ResourceChildCollection` substitutes the
 * Feature collection profile (`src/lib/feature-view/profile.ts`) for its feature tabs, so
 * a set declared here would be dead *and* would collide by name with that profile's
 * `featureColumns` under a different `hiddenColumns` policy. Any set added here must keep
 * a name no `*-view/profile.ts` already exports.
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
 * What "protein" means for a Feature query: annotated CDS and mat-peptide rows. The
 * member Proteins view, the Feature list's `filter=protein` and the multi-genome
 * Proteins tab all have to mean the same thing, so they share these clauses.
 */
const proteinFeatureClauses = [
  `or(${eq("genome_feature", "feature_type", "CDS")},${eq("genome_feature", "feature_type", "mat_peptide")})`,
  eq("genome_feature", "annotation", "PATRIC"),
];

/** `proteinFeatureClauses` as one `and(...)` clause. */
export const proteinFeatureRql = `and(${proteinFeatureClauses.join(",")})`;

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

/**
 * A PPI row does not say which endpoint carries the scoped organism. The A and B
 * sides have identical field shapes, `toGraph` classifies each independently as
 * host or microbial, and `featureInteractionsRql` above already matches a scoped
 * feature on either endpoint — so the genome that feature belongs to can be on
 * either endpoint too. Match both, or the tab drops every row filed B-side.
 */
export function genomeInteractionsRql(genomeId: string): string {
  return `and(or(${eq("ppi", "genome_id_a", genomeId)},${eq("ppi", "genome_id_b", genomeId)}),${eq("ppi", "evidence", "experimental")})`;
}

/**
 * Taxonomy scoping stays A-side only, unlike its Feature and Genome siblings: it
 * resolves a lineage through the Genome relationship join, and the Data API RQL
 * contract accepts only `to(genome_id_a)` for `ppi` (`src/lib/data-api/rql.ts`,
 * locked by `src/lib/data-api/__tests__/rql.test.ts`). There is no B-side join to
 * `or` with, so widening this needs a contract change, not a predicate change.
 */
export function taxonomyInteractionsRql(lineageClause: string): string {
  return `and(eq(genome_id_a,*),genome(to(genome_id_a),and(${lineageClause},ne(genome_status,Deprecated))),eq(evidence,experimental))`;
}
