import { serologyFields } from "@/constants/datafields/serology";
import { deriveFieldMetadata } from "@/lib/views/field-metadata";

export const serologyMetadata = deriveFieldMetadata(serologyFields, {
  resource: "serology",
});
