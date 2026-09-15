import type { ResourceCollectionProfile } from "@/components/views/resource-collection";
import { experimentHref } from "@/lib/views/hrefs";
import { biosetMetadata, experimentMetadata } from "./fields";
import { biosetStructuralRql, experimentStructuralRql } from "./query";
import type { ExperimentViewRecord } from "./schema";

export const experimentColumns = experimentMetadata.columns;
export const experimentDetailFields = experimentMetadata.detailFields;
export const experimentFacets = experimentMetadata.facets;
export const biosetColumns = biosetMetadata.columns;
export const biosetDetailFields = biosetMetadata.detailFields;
export const biosetFacets = biosetMetadata.facets;

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
      "https://www.bv-brc.org/docs/quick_references/organisms_taxon/experiments_comparisons_tables.html",
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
    "https://www.bv-brc.org/docs/quick_references/organisms_taxon/experiments_comparisons_tables.html",
  facets: biosetFacets,
};
