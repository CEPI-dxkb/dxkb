import type { ResourceCollectionProfile } from "@/components/views";
import { genomeAmrMetadata } from "./fields";
import { genomeAmrStructuralRql } from "./query";

/**
 * Legacy AMRPanelGridContainer: raw genome_amr rows with no member page of
 * their own. The Genome Name and Genome ID columns link to the row's genome.
 */
export const genomeAmrCollectionProfile: ResourceCollectionProfile<
  Record<string, unknown>
> = {
  resource: "genome_amr",
  label: "AMR Phenotypes",
  idField: "id",
  columns: genomeAmrMetadata.columns,
  detailFields: genomeAmrMetadata.detailFields,
  basePredicate: "eq(id,*)",
  buildStructuralRql: genomeAmrStructuralRql,
  facets: genomeAmrMetadata.facets,
  guideUrl:
    "https://www.bv-brc.org/docs/quick_references/organisms_taxon/amr_phenotypes.html",
};
