/**
 * Compare Region Viewer fills. These are data colors (a feature's homology
 * family, its identity to the focus gene), so they are inline `fill` values,
 * not theme tokens.
 */
import { interpolateRgb } from "@visx/vendor/d3-interpolate";
import type { CompareRegionFeature } from "./contract";

/**
 * `SEED.get_palette("compare_region")`, read 2026-10-23. The palette is fixed,
 * so it ships with the code instead of costing a request on a service that
 * answers one request at a time.
 */
export const compareRegionPalette: readonly string[] = [
  "rgb(255, 0, 0)", "rgb(60, 60, 190)", "rgb(50, 255, 50)", "rgb(224, 133, 15)",
  "rgb(0, 0, 155)", "rgb(255, 221, 0)", "rgb(0, 155, 155)", "rgb(200, 100, 200)",
  "rgb(27, 133, 52)", "rgb(135, 65, 65)", "rgb(0, 90, 255)", "rgb(95, 100, 100)",
  "rgb(80, 210, 150)", "rgb(225, 250, 160)", "rgb(170, 30, 145)", "rgb(255, 215, 125)",
  "rgb(140, 165, 210)", "rgb(160, 15, 250)", "rgb(45, 155, 185)", "rgb(170, 205, 120)",
  "rgb(30, 60, 190)", "rgb(115, 175, 160)", "rgb(194, 133, 15)", "rgb(0, 0, 125)",
  "rgb(225, 221, 0)", "rgb(235, 5, 40)", "rgb(0, 255, 0)", "rgb(0, 0, 255)",
  "rgb(255, 255, 0)", "rgb(0, 255, 255)", "rgb(255, 0, 255)", "rgb(255, 127, 0)",
  "rgb(255, 0, 127)", "rgb(0, 255, 127)", "rgb(127, 0, 255)", "rgb(127, 255, 0)",
  "rgb(0, 127, 255)", "rgb(255, 127, 127)", "rgb(127, 255, 127)", "rgb(127, 127, 255)",
  "rgb(0, 0, 127)", "rgb(127, 0, 0)", "rgb(0, 127, 0)", "rgb(127, 127, 0)",
  "rgb(127, 0, 127)", "rgb(0, 127, 127)", "rgb(255, 127, 255)", "rgb(255, 255, 127)",
  "rgb(127, 255, 255)",
];

/** Legacy's "gray": a feature in no homology set. */
export const noFamilyFill = "rgb(128, 128, 128)";

/**
 * Each wrap past the palette's end, mixed toward white (positive) or black
 * (negative) by this much. Legacy used white-to-color gradients for the same job.
 */
const wrapShades = [0, 0.45, -0.35, 0.7, -0.6];

/**
 * A homology set's fill. Set 1 (the focus gene's family) takes the first
 * color, as in legacy; set 49 also wraps onto it, one shade lighter.
 */
export function familyFill(family: number): string {
  const index = family === 1 ? 0 : family;
  const size = compareRegionPalette.length;
  const base = compareRegionPalette.at(index % size) ?? noFamilyFill;
  const shade = wrapShades[Math.min(Math.floor(index / size), wrapShades.length - 1)];
  if (shade === 0) return base;
  return interpolateRgb(base, shade > 0 ? "#fff" : "#000")(Math.abs(shade));
}

/** BLAST identity to the focus gene as red at that saturation: 100% red, 0% white. */
export function identityFill(identity: number): string {
  const saturation = Math.min(100, Math.max(0, Math.trunc(identity))) / 100;
  const other = String(Math.round(255 * (1 - saturation)));
  return `rgb(255, ${other}, ${other})`;
}

export function featureFill(
  feature: CompareRegionFeature,
  pinnedFid: string,
): string {
  if (
    feature.type === "blast" ||
    (feature.fid === pinnedFid && feature.identity !== null)
  ) {
    return identityFill(feature.identity ?? 0);
  }
  return feature.family === null ? noFamilyFill : familyFill(feature.family);
}
