import type { ResourceCollectionProfile } from "@/components/views";
import { genomeAmrMetadata } from "./fields";
import { genomeAmrStructuralRql } from "./query";

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
