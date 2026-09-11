import type { DataTableColumn } from "@/components/shared/data-table";
import type { ResourceCollectionProfile } from "@/components/views";
import { surveillanceFields } from "@/constants/datafields/surveillance";
import type { DataField } from "@/constants/datafields/types";
import { surveillanceHref } from "@/lib/views/hrefs";
import { surveillanceStructuralRql } from "./query";
import type { SurveillanceViewRecord } from "./schema";

function tableColumn(definition: DataField): DataTableColumn {
  return {
    id: definition.field,
    label: definition.label,
    visible: !definition.hidden,
    sortable: definition.sortable ?? true,
  };
}

const fields: DataField[] = Object.values(surveillanceFields);

export const surveillanceColumns = fields
  .filter((field) => field.show_in_table !== false)
  .map(tableColumn);
export const surveillanceDetailFields = fields.map((field) => field.field);
export const surveillanceFacets = fields
  .filter((field) => field.facet)
  .map((field) => ({
    field: field.field,
    label: field.label,
    initiallyVisible: field.facet_hidden !== true,
  }));

export const surveillanceCollectionProfile: ResourceCollectionProfile<SurveillanceViewRecord> =
  {
    resource: "surveillance",
    label: "Surveillance",
    idField: "id",
    columns: surveillanceColumns,
    detailFields: surveillanceDetailFields,
    defaultSort: "unsorted",
    basePredicate: "eq(id,*)",
    guideUrl:
      "https://www.bv-brc.org/docs/quick_references/organisms_taxon/surveillance_data.html",
    buildStructuralRql: surveillanceStructuralRql,
    facets: surveillanceFacets,
    rowHref: (row) =>
      surveillanceHref(
        row.sample_identifier,
        row.pathogen_test_type?.length === 1
          ? row.pathogen_test_type[0]
          : undefined,
      ),
    rowLinkField: "sample_identifier",
  };
