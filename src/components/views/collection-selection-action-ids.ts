import type { SearchActionId } from "@/components/search/search-action-bar";

/** Actions the Strain collection owns. Visibility and dispatch read the same list. */
export const strainSelectionActionIds = [
  "copyRows",
  "services",
  "genomes",
  "group",
] as const satisfies readonly SearchActionId[];

/** Genome rows already represent the genome list; member dispatch owns `genome`. */
export const genomeSelectionActionIds = [
  "copyRows",
  "services",
  "group",
] as const satisfies readonly SearchActionId[];

/** Sequence member/export actions remain owned by ResourceCollection. */
export const sequenceSelectionActionIds = [
  "copyRows",
  "services",
  "group",
] as const satisfies readonly SearchActionId[];

/** Feature member/export actions remain owned by ResourceCollection. */
export const featureSelectionActionIds = [
  "copyRows",
  "services",
  "group",
] as const satisfies readonly SearchActionId[];

/** Shared actions for collections with no selectable services. */
export const copyAndServicesSelectionActionIds = [
  "copyRows",
  "services",
] as const satisfies readonly SearchActionId[];

/** Interactions pool both interactors for feature and group actions. */
export const interactionSelectionActionIds = [
  "copyRows",
  "services",
  "ppiFeatures",
  "group",
] as const satisfies readonly SearchActionId[];

/** Experiment and Bioset collections expose only the service chooser here. */
export const servicesOnlySelectionActionIds = [
  "services",
] as const satisfies readonly SearchActionId[];
