import { genomeFields } from "@/constants/datafields/genome";
import { deriveFieldMetadata } from "@/lib/views/field-metadata";

export const genomeMetadata = deriveFieldMetadata(genomeFields, {
  resource: "genome",
  adaptColumn: (column, field) => ({ ...column, valueHref: field.link }),
});
