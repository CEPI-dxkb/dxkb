import { serializeRql } from "@/lib/data-api";
import { featureListHref, genomeListHref } from "@/lib/views/hrefs";
import { isTaxonId } from "./schema";

export const maxTaxonomyActionIds = 500;

/** Shared wording so the collection resolver and normalizeTaxonIds cannot drift. */
export function taxonomyActionLimitMessage(): string {
  return `This action supports at most ${String(maxTaxonomyActionIds)} Taxa. Narrow the selection and try again.`;
}

export function normalizeTaxonIds(values: readonly unknown[]): string[] {
  const ids = [...new Set(values.map(String))];
  if (ids.some((id) => !isTaxonId(id))) {
    throw new Error("Selected Taxa must have positive integer Taxon IDs.");
  }
  if (ids.length > maxTaxonomyActionIds) {
    throw new Error(taxonomyActionLimitMessage());
  }
  return ids;
}

function lineageRql(resource: "genome" | "genome_feature", ids: string[]) {
  const lineage = serializeRql("genome", {
    operator: "in",
    field: "taxon_lineage_ids",
    values: ids,
  });
  const activeGenomes = `and(${lineage},ne(genome_status,Deprecated))`;
  if (resource === "genome") return activeGenomes;
  return `and(eq(genome_id,*),genome(${activeGenomes}),eq(annotation,PATRIC))`;
}

export function taxonomyGenomesHref(values: readonly unknown[]): string {
  const ids = normalizeTaxonIds(values);
  return genomeListHref({ rql: lineageRql("genome", ids) });
}

export function taxonomyFeaturesHref(values: readonly unknown[]): string {
  const ids = normalizeTaxonIds(values);
  return featureListHref({ rql: lineageRql("genome_feature", ids) });
}

export function taxonomyBlastPrefill(values: readonly unknown[]) {
  return {
    db_precomputed_database: "selTaxon",
    db_source: "taxon_list",
    db_taxon_list: normalizeTaxonIds(values),
  } as const;
}
