import { strainFields } from "@/constants/datafields/strain";
import { deriveFieldMetadata } from "@/lib/views/field-metadata";
import {
  isStrainAccessionField,
  strainAccessionUrlTemplate,
} from "./link-policy";

/** The single field-metadata pass behind Strain's columns, details, facets and sorts. */
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
