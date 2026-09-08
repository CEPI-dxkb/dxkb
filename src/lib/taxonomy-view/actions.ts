import { serializeRql } from "@/lib/data-api";
import { featureListHref, genomeListHref } from "@/lib/views/hrefs";
import { isTaxonId } from "./schema";

export const maxTaxonomyActionIds = 500;

export function normalizeTaxonIds(values: readonly unknown[]): string[] {
  const ids = [...new Set(values.map(String))];
  if (ids.some((id) => !isTaxonId(id))) {
    throw new Error("Selected Taxa must have positive integer Taxon IDs.");
  }
  if (ids.length > maxTaxonomyActionIds) {
    throw new Error(
      `This action supports at most ${String(maxTaxonomyActionIds)} Taxa. Narrow the selection and try again.`,
    );
  }
  return ids;
}

function lineageRql(resource: "genome" | "genome_feature", ids: string[]) {
  const lineage = serializeRql("genome", {
    operator: "in",
    field: "taxon_lineage_ids",
    values: ids,
  });
  if (resource === "genome") return lineage;
  return `and(eq(genome_id,*),genome(${lineage}),eq(annotation,PATRIC))`;
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
