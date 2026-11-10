import type { CompareRegionDensity } from "./density-options";

export const rulerHeight = 30;

export const minPlotWidth = 420;

export interface DensitySpec {
  geneHeight: number;
  overlapHeight: number;
  blastHeight: number;
  blastGap: number;
  laneGap: number;
  firstRowGap: number;
  rowGap: number;
  bottomPad: number;
  otherInset: number;
  overlapOtherInset: number;
  contigTick: number;

  headLength: number;
  shortArrowRadii: readonly number[];
  arrowRadii: readonly number[];
  otherRadius: number;
  pinnedStroke: number;
  ringWidth: number;
  pseudoDash: string;
  swatchHeight: number;
  swatchBlast: readonly [number, number];
  swatchOther: readonly [number, number];

  labelSize: number;
  labelPad: number;
  labelMinRoom: number;
  labelMinHeight: number;
  labelBaseline: number;

  restingRibbons: "bands" | "connectors";
  rowTint: boolean;

  labelWidths: readonly [number, number, number];
  tagX: number;
  tagWidth: number;
  tagHeight: number;
  tagRadius: number;
  tagFontSize: number;
  nameX: number;
  endPad: number;
  speciesSize: number;
  strainSize: number;
  lineGap: number;
  identitySize: number;
  focusSize: number;
  identityRoom: number;
  focusRoom: number;
}

const comfortable: DensitySpec = {
  geneHeight: 16,
  overlapHeight: 16,
  blastHeight: 5,
  blastGap: 3,
  laneGap: 4,
  firstRowGap: 16,
  rowGap: 28,
  bottomPad: 16,
  otherInset: 4,
  overlapOtherInset: 4,
  contigTick: 6,
  headLength: 7,
  shortArrowRadii: [1.5, 1, 1.5],
  arrowRadii: [2.5, 2, 1.2, 2, 2.5],
  otherRadius: 2,
  pinnedStroke: 1.5,
  ringWidth: 2,
  pseudoDash: "3 2",
  swatchHeight: 14,
  swatchBlast: [5, 10],
  swatchOther: [3, 11],
  labelSize: 10,
  labelPad: 3.5,
  labelMinRoom: 12,
  labelMinHeight: 0,
  labelBaseline: 3.5,
  restingRibbons: "bands",
  rowTint: false,
  labelWidths: [280, 238, 208],
  tagX: 12,
  tagWidth: 24,
  tagHeight: 16,
  tagRadius: 4,
  tagFontSize: 10,
  nameX: 46,
  endPad: 12,
  speciesSize: 13,
  strainSize: 11.5,
  lineGap: 14,
  identitySize: 11,
  focusSize: 9.5,
  identityRoom: 29,
  focusRoom: 41,
};

const compact: DensitySpec = {
  geneHeight: 12,
  overlapHeight: 8,
  blastHeight: 3,
  blastGap: 1,
  laneGap: 2,
  firstRowGap: 9,
  rowGap: 18,
  bottomPad: 9,
  otherInset: 3,
  overlapOtherInset: 2,
  contigTick: 4.5,
  headLength: 5.5,
  shortArrowRadii: [1.25, 0.8, 1.25],
  arrowRadii: [2, 1.5, 1, 1.5, 2],
  otherRadius: 1.5,
  pinnedStroke: 1.25,
  ringWidth: 1.75,
  pseudoDash: "2.5 1.5",
  swatchHeight: 12,
  swatchBlast: [4, 8],
  swatchOther: [3, 9],
  labelSize: 9.5,
  labelPad: 3,
  labelMinRoom: 11,
  labelMinHeight: 9.5,
  labelBaseline: 3.3,
  restingRibbons: "connectors",
  rowTint: true,
  labelWidths: [232, 204, 176],
  tagX: 8,
  tagWidth: 20,
  tagHeight: 13,
  tagRadius: 3,
  tagFontSize: 9,
  nameX: 35,
  endPad: 8,
  speciesSize: 12,
  strainSize: 10.5,
  lineGap: 12,
  identitySize: 10,
  focusSize: 9,
  identityRoom: 28,
  focusRoom: 38,
};

export const densitySpecs: Record<CompareRegionDensity, DensitySpec> = {
  comfortable,
  compact,
};

export function labelWidthFor(spec: DensitySpec, width: number): number {
  const [wide, middle, narrow] = spec.labelWidths;
  return width >= 1100 ? wide : width >= 700 ? middle : narrow;
}

export function plotWidthFor(spec: DensitySpec, width: number): number {
  return Math.max(width - labelWidthFor(spec, width), minPlotWidth);
}
