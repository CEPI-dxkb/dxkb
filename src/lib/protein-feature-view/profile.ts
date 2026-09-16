import type { ResourceCollectionProfile } from "@/components/views";
import { featureHref } from "@/lib/views/hrefs";
import { proteinFeatureMetadata } from "./fields";
import { proteinFeatureStructuralRql } from "./query";
import type { ProteinFeatureViewRecord } from "./schema";

const proteinFeatureColumns = proteinFeatureMetadata.columns;
const proteinFeatureDetailFields = proteinFeatureMetadata.detailFields;
const proteinFeatureFacets = proteinFeatureMetadata.facets;

export const proteinFeatureCollectionProfile: ResourceCollectionProfile<ProteinFeatureViewRecord> =
  {
    resource: "protein_feature",
    label: "Domains and Motifs",
    idField: "id",
    columns: proteinFeatureColumns,
    detailFields: proteinFeatureDetailFields,
    defaultSort: "unsorted",
    basePredicate: "eq(id,*)",
    buildStructuralRql: proteinFeatureStructuralRql,
    facets: proteinFeatureFacets,
    guideUrl:
      "https://www.bv-brc.org/docs/quick_references/organisms_taxon/domains_and_motifs.html",
    rowHref: (row) => {
      const featureId = row.feature_id ?? row.patric_id;
      return featureId ? featureHref(featureId) : undefined;
    },
    rowLinkField: "patric_id",
  };
