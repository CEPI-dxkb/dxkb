/**
 * The Compare Region Viewer's URL state: `compare.size`, `compare.genomes`,
 * `compare.method`, `compare.filter` and `compare.group` (the workspace path
 * a group filter compares against). `compare.` is a
 * `childCollectionUrlKeys` entry, so switching tabs clears these like any
 * tab-owned param. Defaults are omitted. Written with `replaceState` when the
 * user presses Update: a new setting is not a new page.
 */
import { replaceQuery, toQueryString } from "@/lib/url";
import { featureHref } from "@/lib/views/hrefs";
import {
  defaultCompareRegionSettings,
  parseCompareRegionSettings,
  type CompareRegionSettings,
} from "./contract";

const urlParams: Record<keyof CompareRegionSettings, string> = {
  size: "compare.size",
  genomes: "compare.genomes",
  method: "compare.method",
  filter: "compare.filter",
  group: "compare.group",
};

const settingNames = Object.keys(urlParams) as (keyof CompareRegionSettings)[];

/** The settings a URL carries; all defaults when any value is not offered. */
export function parseCompareRegionUrlState(
  params: Pick<URLSearchParams, "get">,
): CompareRegionSettings {
  return (
    parseCompareRegionSettings((name) => params.get(urlParams[name])) ??
    defaultCompareRegionSettings
  );
}

export function applyCompareRegionUrlState(
  params: URLSearchParams,
  settings: CompareRegionSettings,
): void {
  for (const name of settingNames) {
    const value = settings[name];
    if (value === defaultCompareRegionSettings[name]) params.delete(urlParams[name]);
    else params.set(urlParams[name], String(value));
  }
}

export function writeCompareRegionUrlState(settings: CompareRegionSettings): void {
  replaceQuery((params) => {
    applyCompareRegionUrlState(params, settings);
  });
}

/**
 * The Compare Region tab of `fid`'s Feature View, with `settings` (those that
 * differ from the defaults): the selection strip's "Compare regions" link, so
 * the next gene is compared the same way.
 */
export function compareRegionHref(
  fid: string,
  settings: CompareRegionSettings,
): string {
  const params = new URLSearchParams({ tab: "compare-region" });
  applyCompareRegionUrlState(params, settings);
  return `${featureHref(fid)}?${toQueryString(params)}`;
}
