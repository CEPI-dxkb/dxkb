import type { ResourceCollectionProfile } from "@/components/views";
import { featureHref } from "@/lib/views/hrefs";
import { featureMetadata } from "./fields";
import { featureStructuralRql } from "./query";
import type { FeatureViewRecord } from "./schema";

export const featureColumns = featureMetadata.columns;
const featureDetailFields = featureMetadata.detailFields;
const featureFacets = featureMetadata.facets;

export const featureCollectionProfile: ResourceCollectionProfile<FeatureViewRecord> = {
  resource: "genome_feature",
  label: "Features",
  idField: "feature_id",
  columns: featureColumns,
  detailFields: featureDetailFields,
  defaultSort: "unsorted",
  basePredicate: "eq(feature_id,*)",
  guideUrl: "https://www.bv-brc.org/docs/quick_references/organisms_taxon/features.html",
  buildStructuralRql: featureStructuralRql,
  facets: featureFacets,
  rowHref: (row) => row.feature_id ? featureHref(row.feature_id) : undefined,
  rowLinkField: "patric_id",
};
