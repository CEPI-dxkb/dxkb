import { proteinFeatureFields } from "@/constants/datafields/protein_feature";
import { deriveFieldMetadata } from "@/lib/views/field-metadata";
import { cleanProteinFeatureValue } from "./display";

/**
 * The adapter adds the `link` templates forwarded to `valueHref` and `patric_id`'s fallback to `feature_id`.
 * The InterPro ID cell leaves out the Data API's lone "-" (a blank cell, so no link to `/InterPro/-/`); its sort and filters stay on the stored value.
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
    displayValue:
      field.field === "interpro_id"
        ? function (row) {
            return cleanProteinFeatureValue(row.interpro_id);
          }
        : undefined,
    valueHref: field.link,
  }),
});
