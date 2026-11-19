import { genomeFeatureFields } from "@/constants/datafields/genome_feature";
import { deriveFieldMetadata } from "@/lib/views/field-metadata";
import { cleanFeatureProduct } from "./display";

/**
 * Feature omits hidden columns and facets (hidden facets time out the combined facet query); omitted columns stay sortable.
 * The Product cell leaves out the Data API's "undefined <feature_type>" placeholder; its sort and filters stay on the stored value.
 */
export const featureMetadata = deriveFieldMetadata(genomeFeatureFields, {
  resource: "genome_feature",
  hiddenColumns: "omit",
  hiddenFacets: "omit",
  adaptColumn: (column, field) =>
    field.field === "product"
      ? {
          ...column,
          displayValue: (row) =>
            cleanFeatureProduct(row.product, row.feature_type) || undefined,
        }
      : column,
});
