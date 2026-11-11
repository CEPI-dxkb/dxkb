/**
 * The UI preference definitions import this and are in every page's bundle, so
 * the module imports nothing.
 */
export const compareRegionDensities = ["comfortable", "compact"] as const;

export type CompareRegionDensity = (typeof compareRegionDensities)[number];

export const compareRegionDensityLabels: Record<CompareRegionDensity, string> =
  {
    comfortable: "Comfortable",
    compact: "Compact",
  };

export const compareRegionDensityHints: Record<CompareRegionDensity, string> = {
  comfortable: "Show bigger rows that are easier to read.",
  compact: "Shrink the rows to fit more genomes on screen.",
};
