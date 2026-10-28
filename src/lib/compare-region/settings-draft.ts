/**
 * The Compare Region Viewer's settings bar edits a draft, applied on Update
 * only (as legacy; one request can take a minute). The draft's `filter` is
 * the contract's token. Each group source keeps its own workspace path, so
 * switching between "Selected genome group" and "Selected feature group"
 * loses neither pick, and only the chosen source's path counts.
 */
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
  /** Each group source keeps its own pick, so switching sources loses neither. "" = none. */
  genomeGroup: string;
  featureGroup: string;
}

/** The draft of the applied settings: the applied group fills its own source's slot. */
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

/** Whether two drafts ask for the same thing; the path of a source not chosen does not count. */
export function sameDraft(a: SettingsDraft, b: SettingsDraft): boolean {
  return (
    a.size === b.size &&
    a.genomes === b.genomes &&
    a.method === b.method &&
    a.filter === b.filter &&
    (!isCompareRegionGroupFilter(a.filter) || a[a.filter] === b[a.filter])
  );
}

/** The settings a draft applies: `group` is the chosen group source's path, else null. */
export function draftToSettings(draft: SettingsDraft): CompareRegionSettings {
  const { size, genomes, method, filter } = draft;
  const group = isCompareRegionGroupFilter(filter) ? draft[filter] : "";
  return { size, genomes, method, filter, group: group === "" ? null : group };
}

/**
 * Update is enabled when the draft changed and, for a group source, its
 * group is a workspace path the route accepts (so none picked is not).
 */
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
