/**
 * Every size the Compare Region Viewer's figure draws at, per density.
 * Comfortable has roomy rows; Compact has about 34 px a row, 12 px glyphs
 * and thin connectors at rest. Both set a genome's name on two lines, Compact
 * in smaller type.
 * The geometry modules read their numbers from a `DensitySpec`, so one set of
 * figure layers serves both densities.
 */
import type { CompareRegionDensity } from "./density-options";

/** The bp ruler across the top of the track area, px. The same in both densities. */
export const rulerHeight = 30;

/** The plot's narrowest width, px. Below it the figure scrolls sideways. */
export const minPlotWidth = 420;

export interface DensitySpec {
  // Rows and lanes, px
  /** Lane 0's gene arrow, body and head alike. */
  geneHeight: number;
  /** A lane of overlapping genes under the first. */
  overlapHeight: number;
  /** The BLAST bar under the pinned gene, and its gap to the gene. */
  blastHeight: number;
  blastGap: number;
  /** Between two lanes of genes. */
  laneGap: number;
  /** From the ruler to row 1, between rows (the ribbon zone, divider in its middle), and after the last. */
  firstRowGap: number;
  rowGap: number;
  bottomPad: number;
  /** An RNA or other feature's bar, inset from its lane's top and bottom (lane 0, overlap lanes). */
  otherInset: number;
  overlapOtherInset: number;
  /** Half the height of the tick where a contig ends. */
  contigTick: number;

  // Glyph outlines
  /** An arrow head's length, unless the gene is shorter. */
  headLength: number;
  /** Corner radii of a gene shorter than its head (a triangle) and of a full arrow (a pentagon). */
  shortArrowRadii: readonly number[];
  arrowRadii: readonly number[];
  otherRadius: number;
  /** The pinned gene's edge, the pin ring, and a pseudogene's dashes. */
  pinnedStroke: number;
  ringWidth: number;
  pseudoDash: string;
  /** The tooltip's and selection strip's small glyph: its height and the bars' extents in it. */
  swatchHeight: number;
  swatchBlast: readonly [number, number];
  swatchOther: readonly [number, number];

  // Gene labels (fits or nothing)
  labelSize: number;
  /** Space kept clear between a label and the gene's ends; no label is narrower than `labelMinRoom`. */
  labelPad: number;
  labelMinRoom: number;
  /** Glyphs shorter than this never get a label (Compact's 8 px overlap lanes). */
  labelMinHeight: number;
  /** From the glyph's middle to the label's baseline. */
  labelBaseline: number;

  // Ribbons and rows at rest
  /** Faint bands (Comfortable) or thin center-line connectors with a sideways fade (Compact). */
  restingRibbons: "bands" | "connectors";
  /** Tint the row under the pointer, label column and track alike. */
  rowTint: boolean;

  // Label column
  /** Its width at a card ≥1100, ≥700 and below. */
  labelWidths: readonly [number, number, number];
  tagX: number;
  tagWidth: number;
  tagHeight: number;
  tagRadius: number;
  tagFontSize: number;
  nameX: number;
  /** From the column's right edge to the identity (and the header's "Identity"). */
  endPad: number;
  /**
   * The genome's name on two lines, px: the species (italic, weight 500)
   * over the strain, `lineGap` baseline to baseline. Where the lines sit in
   * the row is `genomeLabelLines`.
   */
  speciesSize: number;
  strainSize: number;
  lineGap: number;
  /** The identity ("70%", mono) and the focus row's "FOCUS", px: on the species' line. */
  identitySize: number;
  focusSize: number;
  /** Room kept right of the name, inside `endPad`: for "100%", or the focus row's wider "FOCUS". */
  identityRoom: number;
  focusRoom: number;
}

/** A row with its BLAST bar is 16 + 3 + 5 + 28 = 52 px. */
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
  // "100%" is 26.4 px at 11 px mono; "FOCUS" 35 px.
  identityRoom: 29,
  focusRoom: 41,
};

/** A row with its BLAST bar is 12 + 1 + 3 + 18 = 34 px: room for the name's two lines. */
const compact: DensitySpec = {
  geneHeight: 12,
  // Too slim for a legible label; the tooltip and pin strip name it.
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
  // "100%" is 24 px at 10 px mono; "FOCUS" 33 px.
  identityRoom: 28,
  focusRoom: 38,
};

export const densitySpecs: Record<CompareRegionDensity, DensitySpec> = {
  comfortable,
  compact,
};

/** The label column's width for a card `width` px wide. */
export function labelWidthFor(spec: DensitySpec, width: number): number {
  const [wide, middle, narrow] = spec.labelWidths;
  return width >= 1100 ? wide : width >= 700 ? middle : narrow;
}

/** The plot's width beside the label column, never below `minPlotWidth`. */
export function plotWidthFor(spec: DensitySpec, width: number): number {
  return Math.max(width - labelWidthFor(spec, width), minPlotWidth);
}
