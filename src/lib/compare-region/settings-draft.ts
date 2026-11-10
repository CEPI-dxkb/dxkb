import {
  isCompareRegionGroupFilter,
  isCompareRegionGroupPath,
  type CompareRegionFilter,
  type CompareRegionGenomeCount,
  type CompareRegionMethod,
  type CompareRegionSettings,
  type CompareRegionSize,
} from "./contract";

export interface SettingsDraft {
  size: CompareRegionSize;
  genomes: CompareRegionGenomeCount;
  method: CompareRegionMethod;
  filter: CompareRegionFilter;
  genomeGroup: string;
  featureGroup: string;
}

export function draftOf(applied: CompareRegionSettings): SettingsDraft {
  const group = applied.group ?? "";
  return {
    size: applied.size,
    genomes: applied.genomes,
    method: applied.method,
    filter: applied.filter,
    genomeGroup: applied.filter === "genomeGroup" ? group : "",
    featureGroup: applied.filter === "featureGroup" ? group : "",
  };
}

export function sameDraft(a: SettingsDraft, b: SettingsDraft): boolean {
  return (
    a.size === b.size &&
    a.genomes === b.genomes &&
    a.method === b.method &&
    a.filter === b.filter &&
    (!isCompareRegionGroupFilter(a.filter) || a[a.filter] === b[a.filter])
  );
}

export function draftToSettings(draft: SettingsDraft): CompareRegionSettings {
  const { size, genomes, method, filter } = draft;
  const group = isCompareRegionGroupFilter(filter) ? draft[filter] : "";
  return { size, genomes, method, filter, group: group === "" ? null : group };
}

export function canApplyDraft(
  draft: SettingsDraft,
  applied: CompareRegionSettings,
): boolean {
  const changed = !sameDraft(draft, draftOf(applied));
  return (
    changed &&
    (!isCompareRegionGroupFilter(draft.filter) ||
      isCompareRegionGroupPath(draft[draft.filter]))
  );
}
