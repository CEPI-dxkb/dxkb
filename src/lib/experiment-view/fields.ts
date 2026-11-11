import { biosetFields } from "@/constants/datafields/bioset";
import { experimentFields } from "@/constants/datafields/experiment";
import { deriveFieldMetadata } from "@/lib/views/field-metadata";

export const experimentMetadata = deriveFieldMetadata(experimentFields, {
  resource: "experiment",
});

export const biosetMetadata = deriveFieldMetadata(biosetFields, {
  resource: "bioset",
});
