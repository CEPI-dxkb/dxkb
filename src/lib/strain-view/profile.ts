import type { ResourceCollectionProfile } from "@/components/views";
import { strainMetadata } from "./fields";
import { strainStructuralRql } from "./query";
import type { StrainViewRecord } from "./schema";

export const strainColumns = strainMetadata.columns;
export const strainDetailFields = strainMetadata.detailFields;
export const strainFacets = strainMetadata.facets;

export const strainCollectionProfile: ResourceCollectionProfile<StrainViewRecord> =
  {
    resource: "strain",
    label: "Strains",
    idField: "id",
    columns: strainColumns,
    detailFields: strainDetailFields,
    defaultSort: "unsorted",
    basePredicate: "eq(id,*)",
    buildStructuralRql: strainStructuralRql,
    facets: strainFacets,
    guideUrl:
      "https://www.bv-brc.org/docs/quick_references/organisms_taxon/strains.html",
  };
