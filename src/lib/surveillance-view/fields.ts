import { surveillanceFields } from "@/constants/datafields/surveillance";
import { deriveFieldMetadata } from "@/lib/views/field-metadata";

/** The single field-metadata pass behind Surveillance's columns, details, facets and sorts. */
export const surveillanceMetadata = deriveFieldMetadata(surveillanceFields, {
  resource: "surveillance",
});
