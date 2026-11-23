/** Import-free: `ui-preferences/definitions.ts` and the client menu both read these. */

export const overviewChartViewTypes = [
  "genome",
  "bacteria",
  "viruses",
  "otherTaxa",
] as const;
export type OverviewChartViewType = (typeof overviewChartViewTypes)[number];

/** The group of pages each view type's hidden list covers, used in the menu heading so a user who sees other charts hidden on another page knows each group keeps its own list. */
export const overviewChartViewTypeScopes: Record<OverviewChartViewType, string> =
  {
    genome: "all genome lists",
    bacteria: "all bacteria",
    viruses: "all viruses",
    otherTaxa: "all other taxa",
  };

/** The lineage group of a Taxonomy page, so hiding a chart for bacteria leaves viruses alone. `accent` is `OrganismLandingConfig["accent"]` (typed `string` here because this module is import-free): fungi and every other lineage share `"otherTaxa"`. */
export function taxonOverviewChartViewType(
  accent: string,
): OverviewChartViewType {
  if (accent === "bacteria") return "bacteria";
  if (accent === "viruses") return "viruses";
  return "otherTaxa";
}

/** Ids of the charts a user hid, per overview. Only hidden ids are stored, so the default is empty and writes no cookie. Read-only, object and lists alike: the default object is shared by `defaultValue`, `defaultUiPreferences` and every parse fallback. */
export type OverviewHiddenCharts = Readonly<
  Record<OverviewChartViewType, readonly string[]>
>;

/** The AMR profile chart has no metadata field, so it gets its own id. Metadata charts use their field name; the taxonomic donut uses `taxonomicDistributionSentinel`. */
export const amrChartId = "amr_profile";

/** Keeps the cookie small: it rides on every request. Chart ids must also stay within the schema's 1 to 40 character cap (`hiddenChartIds` in `ui-preferences/schemas.ts`), or a hidden over-long id would make its whole list fail to parse. */
export const overviewHiddenChartsLimit = 16;

export function emptyOverviewHiddenCharts(): OverviewHiddenCharts {
  return { genome: [], bacteria: [], viruses: [], otherTaxa: [] };
}

/** The same array when nothing changes, a new one otherwise. The preference setter skips the cookie write when `Object.is` holds on the whole `OverviewHiddenCharts` object, so a caller must return the previous object when this returns the same array. */
export function withChartHidden(
  hidden: readonly string[],
  id: string,
  hide: boolean,
): readonly string[] {
  const isHidden = hidden.includes(id);
  if (hide) {
    if (isHidden || hidden.length >= overviewHiddenChartsLimit) return hidden;
    return [...hidden, id];
  }
  return isHidden ? hidden.filter((hiddenId) => hiddenId !== id) : hidden;
}
