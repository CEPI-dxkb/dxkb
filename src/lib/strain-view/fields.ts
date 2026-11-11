import { strainFields } from "@/constants/datafields/strain";
import { deriveFieldMetadata } from "@/lib/views/field-metadata";
import {
  isStrainAccessionField,
  strainAccessionUrlTemplate,
} from "./link-policy";

export const strainMetadata = deriveFieldMetadata(strainFields, {
  resource: "strain",
  adaptColumn: (column, field) => ({
    ...column,
    valueHref:
      field.link ??
      (isStrainAccessionField(field.field)
        ? strainAccessionUrlTemplate
        : undefined),
  }),
});
