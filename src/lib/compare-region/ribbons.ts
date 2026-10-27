/**
 * The Compare Region Viewer's ribbons, which join same-family genes in
 * adjacent rows. At rest they cover only the families most genomes share,
 * reaching rarer families as the zoom grows: Comfortable draws faint bands,
 * Compact thin center-line connectors. The family trace draws full bands.
 * Paths are in track pixels, under the zoom's `x`.
 */
import type { DensitySpec } from "./density";
import type { ChartModel, Ribbon } from "./families";
import { glyphBox, type FigureFrame } from "./figure-frame";
import { roundPx } from "./glyph-paths";
import type { CompareRegionLayout } from "./layout";

/**
 * A ribbon's React key: its family and both genes' refs. `indexFamilies`
 * joins a pair of genes once, and a bridge set joins each row to one next
 * row, so the key is unique within either list.
 */
export function ribbonKey(ribbon: Ribbon): string {
  const { upper, lower } = ribbon;
  return [
    ribbon.family,
    upper.rowIndex,
    upper.featureIndex,
    lower.rowIndex,
    lower.featureIndex,
  ].join(":");
}

// ---------------------------------------------------------------------------
// Ribbons by zoom
// ---------------------------------------------------------------------------

/**
 * How many genomes a family must appear in for its ribbons to show at rest:
 * half the rows at 1×, fewer as the zoom grows (a third at 1.5×, …), down to
 * every family shared by two genomes.
 */
export function ribbonMinRows(zoom: number, rowTotal: number): number {
  return Math.max(2, Math.ceil((rowTotal * 0.5) / Math.max(zoom, 1)));
}

/** How far the zoom is from 1× to 5×, 0 to 1. */
function zoomShare(zoom: number): number {
  return Math.min(1, Math.max(0, Math.log(Math.max(zoom, 1)) / Math.log(5)));
}

/** Resting band opacity (Comfortable): a faint texture at 1×, a little firmer from 5× on. */
export function ribbonAlpha(zoom: number): number {
  return Math.round((0.12 + 0.1 * zoomShare(zoom)) * 1000) / 1000;
}

/** Resting connector opacity (Compact): a line needs more than a band's 0.12, so 0.5 at 1× to 0.7 at 5×. */
export function connectorAlpha(zoom: number): number {
  return Math.round((0.5 + 0.2 * zoomShare(zoom)) * 1000) / 1000;
}

/**
 * The ribbons the figure shows at rest at `zoom`: those of the families in at
 * least `ribbonMinRows` genomes. Never the focus family's, whose genes
 * already stack on the focus line.
 */
export function restingRibbons(model: ChartModel, zoom: number): Ribbon[] {
  const { families } = model;
  const minRows = ribbonMinRows(zoom, model.layout.rows.length);
  return families.ribbons.filter(
    (ribbon) =>
      ribbon.family !== 1 &&
      (families.rowCount.get(ribbon.family) ?? 0) >= minRows,
  );
}

// ---------------------------------------------------------------------------
// Paths: a band (at rest in Comfortable, traced in both) or a thin connector
// ---------------------------------------------------------------------------

interface RibbonEnds {
  a1: number;
  a2: number;
  b1: number;
  b2: number;
  top: number;
  bottom: number;
}

/**
 * Both genes' ends on screen and the gap between them; null when the whole
 * ribbon lies more than `reach` px off the plot (see `placeGlyph`).
 */
function ribbonEnds(
  spec: DensitySpec,
  layout: CompareRegionLayout,
  frame: FigureFrame,
  ribbon: Ribbon,
  x: (offset: number) => number,
  plotWidth: number,
  reach: number,
): RibbonEnds | null {
  const a =
    layout.rows[ribbon.upper.rowIndex].features[ribbon.upper.featureIndex];
  const b =
    layout.rows[ribbon.lower.rowIndex].features[ribbon.lower.featureIndex];
  const a1 = x(a.from);
  const a2 = x(a.to);
  const b1 = x(b.from);
  const b2 = x(b.to);
  if (
    Math.max(a1, a2, b1, b2) < -2 - reach ||
    Math.min(a1, a2, b1, b2) > plotWidth + 2 + reach
  ) {
    return null;
  }
  const top = glyphBox(spec, frame.rows[ribbon.upper.rowIndex], a).bottom + 0.5;
  const bottom = glyphBox(spec, frame.rows[ribbon.lower.rowIndex], b).top - 0.5;
  return { a1, a2, b1, b2, top, bottom };
}

/**
 * A ribbon's band from the upper gene's bottom edge to the lower gene's top
 * edge, as two vertical-tangent cubic curves. Genes pointing opposite ways
 * (an inversion) join left to right, so the band twists into a bow tie.
 */
export function ribbonPath(
  spec: DensitySpec,
  layout: CompareRegionLayout,
  frame: FigureFrame,
  ribbon: Ribbon,
  x: (offset: number) => number,
  plotWidth: number,
  reach = 0,
): string | null {
  const ends = ribbonEnds(spec, layout, frame, ribbon, x, plotWidth, reach);
  if (!ends) return null;
  const { a1, a2, b1, b2, top, bottom } = ends;
  const middle = (top + bottom) / 2;
  const aLeft = Math.min(a1, a2);
  const aRight = Math.max(a1, a2);
  const sameWay = a2 - a1 >= 0 === b2 - b1 >= 0;
  const bUnderLeft = sameWay ? Math.min(b1, b2) : Math.max(b1, b2);
  const bUnderRight = sameWay ? Math.max(b1, b2) : Math.min(b1, b2);
  const p = roundPx;
  return [
    `M${p(aLeft)},${p(top)}`,
    `C${p(aLeft)},${p(middle)} ${p(bUnderLeft)},${p(middle)} ${p(bUnderLeft)},${p(bottom)}`,
    `L${p(bUnderRight)},${p(bottom)}`,
    `C${p(bUnderRight)},${p(middle)} ${p(aRight)},${p(middle)} ${p(aRight)},${p(top)}Z`,
  ].join("");
}

/** Connectors reaching further sideways than this (px) start to fade, down to `minReachFade`. */
const reachFadeFrom = 48;
const reachFadeSpan = 500;
const minReachFade = 0.35;

/**
 * How much a connector `reach` px sideways is quieted (a moved homolog), as
 * a factor on its opacity: 1 up to 48 px, down to 0.35 at 373 px and beyond,
 * since a long diagonal is the busiest mark a resting figure can hold.
 */
export function connectorFade(reach: number): number {
  return Math.max(
    minReachFade,
    1 - Math.max(0, reach - reachFadeFrom) / reachFadeSpan,
  );
}

/**
 * Compact's resting ribbon: one vertical-tangent curve from the middle of the
 * upper gene's bottom edge to the middle of the lower gene's top edge (a
 * center line, stroked 1.25 px), so dense rows do not fill up with color.
 * `reach` is how far it runs sideways, for `connectorFade`.
 */
export function connectorPath(
  spec: DensitySpec,
  layout: CompareRegionLayout,
  frame: FigureFrame,
  ribbon: Ribbon,
  x: (offset: number) => number,
  plotWidth: number,
  reach = 0,
): { d: string; reach: number } | null {
  const ends = ribbonEnds(spec, layout, frame, ribbon, x, plotWidth, reach);
  if (!ends) return null;
  const { a1, a2, b1, b2, top, bottom } = ends;
  const from = (a1 + a2) / 2;
  const to = (b1 + b2) / 2;
  const middle = (top + bottom) / 2;
  const p = roundPx;
  return {
    d: `M${p(from)},${p(top)}C${p(from)},${p(middle)} ${p(to)},${p(middle)} ${p(to)},${p(bottom)}`,
    reach: Math.abs(to - from),
  };
}
