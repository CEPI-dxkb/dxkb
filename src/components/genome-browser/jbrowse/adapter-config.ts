import { ConfigurationSchema } from "@jbrowse/core/configuration";
import type { Instance } from "@jbrowse/mobx-state-tree";

export const featureAdapterConfig = ConfigurationSchema(
  "BvbrcFeatureAdapter",
  {
    genomeId: { type: "string", defaultValue: "" },
    annotation: { type: "string", defaultValue: "PATRIC" },
  },
  { explicitlyTyped: true },
);
export type BvbrcFeatureAdapterConfig = Instance<typeof featureAdapterConfig>;

export const sequenceAdapterConfig = ConfigurationSchema(
  "BvbrcSequenceAdapter",
  { genomeId: { type: "string", defaultValue: "" } },
  { explicitlyTyped: true },
);
export type BvbrcSequenceAdapterConfig = Instance<typeof sequenceAdapterConfig>;
