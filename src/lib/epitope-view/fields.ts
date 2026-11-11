import { epitopeFields } from "@/constants/datafields/epitope";
import { epitopeAssayFields } from "@/constants/datafields/epitope_assay";
import { deriveFieldMetadata } from "@/lib/views/field-metadata";

export const epitopeMetadata = deriveFieldMetadata(epitopeFields, {
  resource: "epitope",
});

export const epitopeAssayMetadata = deriveFieldMetadata(epitopeAssayFields, {
  resource: "epitope_assay",
  adaptColumn: (column, field) => ({ ...column, valueHref: field.link }),
});
