import { genomeSequenceFields } from "@/constants/datafields/genome_sequence";
import { ppiFields } from "@/constants/datafields/ppi";
import { sequenceFeatureFields } from "@/constants/datafields/sequence_feature";
import type { ResourceCollectionProfile } from "@/components/views/resource-collection";
import { eq } from "@/lib/data-api";
import type { CollectionDownloadSpec } from "@/lib/data-api/downloads";
import { childCollectionOptions } from "./child-collection-state";
import type { CollectionState } from "./collection-state";
import { deriveFieldMetadata } from "./field-metadata";
import { rqlAnd, rqlAnyOf } from "./rql";
import { structuralFilterRql } from "./structural-rql";

/**
 * Child tabs run through the same metadata pass, so columns carry the
 * registry's sortability; they hold their sort in state rather than the URL, so
 * only `columns` is used.
 * `genome_feature` is deliberately absent: `ResourceChildCollection`
 * substitutes the Feature profile (`feature-view/profile.ts`), which uses
 * `hiddenColumns: "omit"` where this module uses the default collapse.
 */
const genomeSequenceMetadata = deriveFieldMetadata(genomeSequenceFields, {
  resource: "genome_sequence",
});
export const genomeSequenceColumns = genomeSequenceMetadata.columns;

/**
 * Legacy SequenceGridContainer: genome_sequence rows faceted on every field
 * the metadata flags `facet` (Public included). `ResourceChildCollection`
 * uses this for every Sequences tab, so those tabs pass no columns.
 */
export const genomeSequenceCollectionProfile: ResourceCollectionProfile<
  Record<string, unknown>
> = {
  resource: "genome_sequence",
  label: "Sequences",
  idField: "sequence_id",
  columns: genomeSequenceMetadata.columns,
  detailFields: genomeSequenceMetadata.detailFields,
  basePredicate: "eq(sequence_id,*)",
  buildStructuralRql: (state: CollectionState) =>
    structuralFilterRql("genome_sequence", state),
  facets: genomeSequenceMetadata.facets,
  guideUrl:
    "https://www.bv-brc.org/docs/quick_references/organisms_taxon/sequences.html",
};
const interactionMetadata = deriveFieldMetadata(ppiFields, { resource: "ppi" });
export const interactionColumns = interactionMetadata.columns;

export const interactionFacets = interactionMetadata.facets;

/**
 * The taxon Interactions tab shows experimental interactions until the user
 * says otherwise (legacy's default filter): a removable facet value, like the
 * Feature list's `annotation`. The scope (`taxonomyInteractionsRql`) pins no
 * evidence, so removing or changing the pick in the Filters menu really does
 * widen both the Table and the Graph. The Genome and Feature tabs have no
 * evidence facet and keep their pinned `eq(evidence,experimental)`.
 */
export const interactionDefaultFilters = { evidence: ["experimental"] } as const;

/**
 * The Interactions "focus on this protein" filter: a URL filter, not a facet
 * (no counts, no menu entry of its own), so it is named here and in
 * `filterLabels`, never in `interactionFacets`.
 */
export const interactionExtraFilters = ["interactor"] as const;

/**
 * `interactor` is not a PPI field, so it never reaches `structuralFilterRql`
 * (which would send it as `eq(interactor,…)`). It matches the protein on either
 * side of the interaction, as a row files it A- or B-side.
 */
export function interactionStructuralRql(
  state: CollectionState,
): string | undefined {
  const { interactor = [], ...facetFilters } = state.filters;
  const focus = interactor
    .filter((id) => id !== "")
    .map(
      (id) =>
        `or(${eq("ppi", "interactor_a", id)},${eq("ppi", "interactor_b", id)})`,
    );
  const clauses = [
    focus.length > 0 ? rqlAnyOf(focus) : undefined,
    structuralFilterRql("ppi", { ...state, filters: facetFilters }),
  ].filter((clause): clause is string => clause !== undefined);
  return clauses.length === 0 ? undefined : rqlAnd(...clauses);
}

/**
 * Opt-in (pass as `ResourceChildCollection`'s `profile`) for the taxon
 * Interactions Table + Graph. Genome and Feature Interactions tabs keep the
 * plain columns-only table. No `detailFields`: the detail fetch stays what the
 * generic child branch uses (the columns).
 */
export const interactionCollectionProfile: ResourceCollectionProfile<
  Record<string, unknown>
> = {
  resource: "ppi",
  label: "Interactions",
  idField: "id",
  columns: interactionColumns,
  basePredicate: "eq(id,*)",
  buildStructuralRql: interactionStructuralRql,
  facets: interactionFacets,
  extraFilters: interactionExtraFilters,
  filterLabels: { interactor: "Protein" },
};

/**
 * One expression for both writers of the `interactions.*` params: the shell
 * (which reads the filters for the Graph) and `ResourceChildCollection` (which
 * builds the same from the profile and the shell's `defaultSort` and
 * `defaultFilters` props, both taken from here). Built apart, one could drop
 * the other's param on a write, or parse the evidence default into a state the
 * other does not share.
 */
export const interactionCollectionOptions = childCollectionOptions(
  interactionCollectionProfile.columns,
  interactionCollectionProfile.facets,
  "id:asc",
  interactionDefaultFilters,
  interactionCollectionProfile.extraFilters,
);

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

export function genomeAmrRql(genomeId: string): string {
  return eq("genome_amr", "genome_id", genomeId);
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
 * Pins no evidence: the Interactions tab adds it as a removable default filter
 * (`interactionDefaultFilters`), so a clause here would hold computational
 * interactions out whatever the user picks.
 */
export function taxonomyInteractionsRql(lineageClause: string): string {
  return `and(eq(genome_id_a,*),genome(to(genome_id_a),and(${lineageClause},ne(genome_status,Deprecated))))`;
}
