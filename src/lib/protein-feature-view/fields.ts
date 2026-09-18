import { proteinFeatureFields } from "@/constants/datafields/protein_feature";
import { deriveFieldMetadata } from "@/lib/views/field-metadata";

/**
 * The single field-metadata pass behind Protein Feature's columns, details, facets and
 * sorts. The adapter carries the two things the metadata cannot express: the metadata
 * `link` templates this resource has always forwarded to `valueHref`, and `patric_id`'s
 * fallback to `feature_id` for rows with no PATRIC identifier.
 */
export const proteinFeatureMetadata = deriveFieldMetadata(proteinFeatureFields, {
  resource: "protein_feature",
  adaptColumn: (column, field) => ({
    ...column,
    fallbackValue:
      field.field === "patric_id"
        ? function (row) {
            return row.feature_id;
          }
        : undefined,
    valueHref: field.link,
  }),
});
