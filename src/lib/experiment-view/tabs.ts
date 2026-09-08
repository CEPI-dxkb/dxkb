import type { EntityViewTab } from "@/components/views/entity-view-shell";

export const experimentTabKeys = ["overview", "biosets"] as const;
export type ExperimentTab = (typeof experimentTabKeys)[number];

export const experimentCollectionTabKeys = ["experiments", "biosets"] as const;
export type ExperimentCollectionTab = (typeof experimentCollectionTabKeys)[number];

export function parseExperimentCollectionTab(
  value: string | string[] | undefined,
): ExperimentCollectionTab {
  const tab = Array.isArray(value) ? value[0] : value;
  return experimentCollectionTabKeys.includes(tab as ExperimentCollectionTab)
    ? (tab as ExperimentCollectionTab)
    : "experiments";
}

export function parseExperimentTab(
  value: string | string[] | undefined,
): ExperimentTab {
  const tab = Array.isArray(value) ? value[0] : value;
  return experimentTabKeys.includes(tab as ExperimentTab)
    ? (tab as ExperimentTab)
    : "overview";
}

export const experimentTabs: readonly EntityViewTab<ExperimentTab>[] = [
  { key: "overview", label: "Overview" },
  { key: "biosets", label: "Biosets" },
];
