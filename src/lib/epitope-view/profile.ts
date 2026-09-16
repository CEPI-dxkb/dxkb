import type { ResourceCollectionProfile } from "@/components/views";
import { epitopeHref } from "@/lib/views/hrefs";
import { epitopeAssayMetadata, epitopeMetadata } from "./fields";
import { epitopeStructuralRql } from "./query";
import type { EpitopeViewRecord } from "./schema";

const epitopeColumns = epitopeMetadata.columns;
const epitopeDetailFields = epitopeMetadata.detailFields;
const epitopeFacets = epitopeMetadata.facets;

export const epitopeAssayColumns = epitopeAssayMetadata.columns;

export const epitopeCollectionProfile: ResourceCollectionProfile<EpitopeViewRecord> = {
  resource: "epitope",
  label: "Epitopes",
  idField: "epitope_id",
  columns: epitopeColumns,
  detailFields: epitopeDetailFields,
  basePredicate: "eq(epitope_id,*)",
  guideUrl: "https://www.bv-brc.org/docs/quick_references/organisms_taxon/epitopes.html",
  buildStructuralRql: epitopeStructuralRql,
  facets: epitopeFacets,
  rowHref: (row) => epitopeHref(row.epitope_id),
  rowLinkField: "epitope_id",
};
