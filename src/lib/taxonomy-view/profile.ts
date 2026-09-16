import type { ResourceCollectionProfile } from "@/components/views";
import { taxonomyHref } from "@/lib/views/hrefs";
import { taxonomyMetadata } from "./fields";
import { taxonomyStructuralRql } from "./query";
import type { TaxonomyViewRecord } from "./schema";

export const taxonomyColumns = taxonomyMetadata.columns;
const taxonomyDetailFields = taxonomyMetadata.detailFields;
const taxonomyFacets = taxonomyMetadata.facets;

export const taxonomyCollectionProfile: ResourceCollectionProfile<TaxonomyViewRecord> = {
  resource: "taxonomy",
  label: "Taxa",
  idField: "taxon_id",
  columns: taxonomyColumns,
  detailFields: taxonomyDetailFields,
  defaultSort: "unsorted",
  basePredicate: "eq(taxon_id,*)",
  guideUrl:
    "https://www.bv-brc.org/docs/quick_references/organisms_taxon/taxonomy.html",
  buildStructuralRql: taxonomyStructuralRql,
  serverKeywordMode: "exact",
  facets: taxonomyFacets,
  rowHref: (row) => taxonomyHref(row.taxon_id),
  rowLinkFields: ["taxon_id", "taxon_name"],
};
