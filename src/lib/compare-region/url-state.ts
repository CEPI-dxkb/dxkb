/**
 * `compare.` is a `childCollectionUrlKeys` entry, so switching tabs clears
 * these like any tab-owned param.
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

export function compareRegionHref(
  fid: string,
  settings: CompareRegionSettings,
): string {
  const params = new URLSearchParams({ tab: "compare-region" });
  applyCompareRegionUrlState(params, settings);
  return `${featureHref(fid)}?${toQueryString(params)}`;
}
