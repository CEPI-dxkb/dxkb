import { serologyFields } from "@/constants/datafields/serology";
import { deriveFieldMetadata } from "@/lib/views/field-metadata";

/** The single field-metadata pass behind Serology's columns, details, facets and sorts. */
export const serologyMetadata = deriveFieldMetadata(serologyFields, {
  resource: "serology",
});
