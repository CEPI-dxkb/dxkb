import type { DataTableColumn } from "@/components/shared/data-table";
import type { ResourceCollectionProfile } from "@/components/views";
import { serologyFields } from "@/constants/datafields/serology";
import type { DataField } from "@/constants/datafields/types";
import { serologyHref } from "@/lib/views/hrefs";
import { serologyStructuralRql } from "./query";
import type { SerologyViewRecord } from "./schema";

function tableColumn(definition: DataField): DataTableColumn {
  return {
    id: definition.field,
    label: definition.label,
    visible: !definition.hidden,
    sortable: definition.sortable ?? true,
  };
}

const fields: DataField[] = Object.values(serologyFields);

export const serologyColumns = fields
  .filter((field) => field.show_in_table !== false)
  .map(tableColumn);
export const serologyDetailFields = fields.map((field) => field.field);
export const serologyFacets = fields
  .filter((field) => field.facet)
  .map((field) => ({
    field: field.field,
    label: field.label,
    initiallyVisible: field.facet_hidden !== true,
  }));

export const serologyCollectionProfile: ResourceCollectionProfile<SerologyViewRecord> =
  {
    resource: "serology",
    label: "Serology",
    idField: "id",
    columns: serologyColumns,
    detailFields: serologyDetailFields,
    defaultSort: "unsorted",
    basePredicate: "eq(id,*)",
    guideUrl:
      "https://www.bv-brc.org/docs/quick_references/organisms_taxon/serology_data.html",
    buildStructuralRql: serologyStructuralRql,
    facets: serologyFacets,
    rowHref: (row) => serologyHref(row.sample_identifier, row.test_type),
    rowLinkField: "sample_identifier",
  };
