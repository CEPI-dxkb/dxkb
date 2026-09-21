import { taxonomyFields } from "@/constants/datafields/taxonomy";
import { deriveFieldMetadata } from "@/lib/views/field-metadata";

/** The single field-metadata pass behind Taxonomy's columns, details, facets and sorts. */
export const taxonomyMetadata = deriveFieldMetadata(taxonomyFields, {
  resource: "taxonomy",
});
