import { genomeFields } from "@/constants/datafields/genome";
import { deriveFieldMetadata } from "@/lib/views/field-metadata";

/** The single field-metadata pass behind Genome's columns, details, facets and sorts. */
export const genomeMetadata = deriveFieldMetadata(genomeFields, {
  resource: "genome",
});
