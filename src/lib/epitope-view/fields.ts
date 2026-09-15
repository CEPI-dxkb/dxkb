import { epitopeFields } from "@/constants/datafields/epitope";
import { epitopeAssayFields } from "@/constants/datafields/epitope_assay";
import { deriveFieldMetadata } from "@/lib/views/field-metadata";

/** The single field-metadata pass behind Epitope's columns, details, facets and sorts. */
export const epitopeMetadata = deriveFieldMetadata(epitopeFields, {
  resource: "epitope",
});

export const epitopeAssayMetadata = deriveFieldMetadata(epitopeAssayFields, {
  resource: "epitope_assay",
});
