import { biosetFields } from "@/constants/datafields/bioset";
import { experimentFields } from "@/constants/datafields/experiment";
import { deriveFieldMetadata } from "@/lib/views/field-metadata";

/** The single field-metadata pass behind Experiment's columns, details, facets and sorts. */
export const experimentMetadata = deriveFieldMetadata(experimentFields, {
  resource: "experiment",
});

export const biosetMetadata = deriveFieldMetadata(biosetFields, {
  resource: "bioset",
});
