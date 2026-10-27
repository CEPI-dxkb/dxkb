/**
 * The Compare Region Viewer's two densities, by name only. The UI preference
 * definitions import this, and they are in every page's bundle, so the module
 * imports nothing: the figure geometry each density sets lives in `density.ts`.
 */
export const compareRegionDensities = ["comfortable", "compact"] as const;

export type CompareRegionDensity = (typeof compareRegionDensities)[number];

export const compareRegionDensityLabels: Record<CompareRegionDensity, string> =
  {
    comfortable: "Comfortable",
    compact: "Compact",
  };

export const compareRegionDensityHints: Record<CompareRegionDensity, string> = {
  comfortable: "Roomy rows, two-line genome names",
  compact: "About 30 px a row, for long genome lists",
};
