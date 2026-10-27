import { ConfigurationSchema } from "@jbrowse/core/configuration";
import type { Instance } from "@jbrowse/mobx-state-tree";

/**
 * The two BV-BRC adapters' config schemas, apart from the adapter classes,
 * which type their configs from these (`./adapters.ts` imports the types and
 * `./plugin.ts` registers both).
 */
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
