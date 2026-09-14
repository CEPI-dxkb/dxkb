import type { DataTableColumn } from "@/components/shared/data-table";
import type { ResourceCollectionProfile } from "@/components/views";
import { taxonomyFields } from "@/constants/datafields/taxonomy";
import type { DataField } from "@/constants/datafields/types";
import { taxonomyHref } from "@/lib/views/hrefs";
import { taxonomyStructuralRql } from "./query";
import type { TaxonomyViewRecord } from "./schema";

const fields = Object.values(taxonomyFields) as DataField[];

export const taxonomyColumns: readonly DataTableColumn[] = fields
  .filter((field) => field.show_in_table !== false)
  .map((field) => ({
    id: field.field,
    label: field.label,
    visible: !field.hidden,
    sortable: field.sortable ?? true,
  }));

export const taxonomyDetailFields = fields.map((field) => field.field);

export const taxonomyFacets = fields
  .filter((field) => field.facet)
  .map((field) => ({
    field: field.field,
    label: field.label,
    initiallyVisible: field.facet_hidden !== true,
  }));

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
