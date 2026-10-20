import { genomeAmrFields } from "@/constants/datafields/genome_amr";
import { deriveFieldMetadata } from "@/lib/views/field-metadata";

/** The single field-metadata pass behind AMR Phenotypes' columns, details, facets and sorts. */
export const genomeAmrMetadata = deriveFieldMetadata(genomeAmrFields, {
  resource: "genome_amr",
  adaptColumn: (column, field) => ({ ...column, valueHref: field.link }),
});
