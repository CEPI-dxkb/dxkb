/**
 * The Compare Region Viewer's URL state: `compare.size`, `compare.genomes`,
 * `compare.method` and `compare.filter`. `compare.` is a
 * `childCollectionUrlKeys` entry, so switching tabs clears these like any
 * tab-owned param. Defaults are omitted. Written with `replaceState` when the
 * user presses Update: a new setting is not a new page.
 */
import { replaceQuery } from "@/lib/url";
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
