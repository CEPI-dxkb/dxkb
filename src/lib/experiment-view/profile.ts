import type { DataTableColumn } from "@/components/shared/data-table";
import type { ResourceCollectionProfile } from "@/components/views/resource-collection";
import { biosetFields } from "@/constants/datafields/bioset";
import { experimentFields } from "@/constants/datafields/experiment";
import type { DataField } from "@/constants/datafields/types";
import { experimentHref } from "@/lib/views/hrefs";
import { biosetStructuralRql, experimentStructuralRql } from "./query";
import type { ExperimentViewRecord } from "./schema";

function tableColumn(definition: DataField): DataTableColumn {
  return {
    id: definition.field,
    label: definition.label,
    visible: !definition.hidden,
    sortable: definition.sortable ?? true,
  };
}

function deriveProfileFields(fieldMap: Record<string, DataField>) {
  const fields = Object.values(fieldMap);

  return {
    columns: fields
      .filter((field) => field.show_in_table !== false)
      .map(tableColumn),
    detailFields: fields.map((field) => field.field),
    facets: fields
      .filter((field) => field.facet && field.facet_hidden !== true)
      .map((field) => ({
        field: field.field,
        label: field.label,
        initiallyVisible: true,
      })),
  };
}

const experimentProfileFields = deriveProfileFields(experimentFields);
const biosetProfileFields = deriveProfileFields(biosetFields);

export const experimentColumns = experimentProfileFields.columns;
export const experimentDetailFields = experimentProfileFields.detailFields;
export const experimentFacets = experimentProfileFields.facets;
export const biosetColumns = biosetProfileFields.columns;
export const biosetDetailFields = biosetProfileFields.detailFields;
export const biosetFacets = biosetProfileFields.facets;

export const experimentCollectionProfile: ResourceCollectionProfile<ExperimentViewRecord> =
  {
    resource: "experiment",
    label: "Experiments",
    idField: "exp_id",
    columns: experimentColumns,
    detailFields: experimentDetailFields,
    defaultSort: "unsorted",
    basePredicate: "eq(exp_id,*)",
    guideUrl:
      "https://www.bv-brc.org/docs/quick_references/organisms_taxon/experiments.html",
    buildStructuralRql: experimentStructuralRql,
    facets: experimentFacets,
    rowHref: (row) => experimentHref(row.exp_id),
    rowLinkField: "exp_id",
  };

export const biosetCollectionProfile: ResourceCollectionProfile<
  Record<string, unknown>
> = {
  resource: "bioset",
  label: "Biosets",
  idField: "bioset_id",
  columns: biosetColumns,
  detailFields: biosetDetailFields,
  defaultSort: "bioset_id:asc",
  basePredicate: "eq(bioset_id,*)",
  buildStructuralRql: biosetStructuralRql,
  guideUrl:
    "https://www.bv-brc.org/docs/quick_references/organisms_taxon/experiments.html",
  facets: biosetFacets,
};
