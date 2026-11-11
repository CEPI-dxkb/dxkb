import type { SearchActionId } from "@/components/search/search-action-bar";

export const strainSelectionActionIds = [
  "copyRows",
  "services",
  "genomes",
  "group",
] as const satisfies readonly SearchActionId[];

export const genomeSelectionActionIds = [
  "copyRows",
  "services",
  "group",
] as const satisfies readonly SearchActionId[];

export const sequenceSelectionActionIds = [
  "copyRows",
  "services",
  "group",
] as const satisfies readonly SearchActionId[];

export const featureSelectionActionIds = [
  "copyRows",
  "services",
  "group",
] as const satisfies readonly SearchActionId[];

export const copyAndServicesSelectionActionIds = [
  "copyRows",
  "services",
] as const satisfies readonly SearchActionId[];

export const interactionSelectionActionIds = [
  "copyRows",
  "services",
  "ppiFeatures",
  "group",
] as const satisfies readonly SearchActionId[];

export const servicesOnlySelectionActionIds = [
  "services",
] as const satisfies readonly SearchActionId[];
