import { proteinFeatureFields } from "@/constants/datafields/protein_feature";
import { deriveFieldMetadata } from "@/lib/views/field-metadata";

/** The adapter adds the `link` templates forwarded to `valueHref` and `patric_id`'s fallback to `feature_id`. */
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
