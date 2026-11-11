import { taxonomyFields } from "@/constants/datafields/taxonomy";
import { deriveFieldMetadata } from "@/lib/views/field-metadata";

export const taxonomyMetadata = deriveFieldMetadata(taxonomyFields, {
  resource: "taxonomy",
});
