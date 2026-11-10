import { genomeFeatureFields } from "@/constants/datafields/genome_feature";
import { deriveFieldMetadata } from "@/lib/views/field-metadata";

/** Feature omits hidden columns and facets (hidden facets time out the combined facet query); omitted columns stay sortable. */
export const featureMetadata = deriveFieldMetadata(genomeFeatureFields, {
  resource: "genome_feature",
  hiddenColumns: "omit",
  hiddenFacets: "omit",
});
