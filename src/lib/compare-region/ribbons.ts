import type { DensitySpec } from "./density";
import type { ChartModel, Ribbon } from "./families";
import { glyphBox, type FigureFrame } from "./figure-frame";
import { roundPx } from "./glyph-paths";
import type { CompareRegionLayout } from "./layout";

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

export function ribbonMinRows(zoom: number, rowTotal: number): number {
  return Math.max(2, Math.ceil((rowTotal * 0.5) / Math.max(zoom, 1)));
}

function zoomShare(zoom: number): number {
  return Math.min(1, Math.max(0, Math.log(Math.max(zoom, 1)) / Math.log(5)));
}

export function ribbonAlpha(zoom: number): number {
  return Math.round((0.12 + 0.1 * zoomShare(zoom)) * 1000) / 1000;
}

export function connectorAlpha(zoom: number): number {
  return Math.round((0.5 + 0.2 * zoomShare(zoom)) * 1000) / 1000;
}

export function restingRibbons(model: ChartModel, zoom: number): Ribbon[] {
  const { families } = model;
  const minRows = ribbonMinRows(zoom, model.layout.rows.length);
  return families.ribbons.filter(
    (ribbon) =>
      ribbon.family !== 1 &&
      (families.rowCount.get(ribbon.family) ?? 0) >= minRows,
  );
}

interface RibbonEnds {
  a1: number;
  a2: number;
  b1: number;
  b2: number;
  top: number;
  bottom: number;
}

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
 * Genes pointing opposite ways (an inversion) join left to right, so the band
 * twists into a bow tie.
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

const reachFadeFrom = 48;
const reachFadeSpan = 500;
const minReachFade = 0.35;

export function connectorFade(reach: number): number {
  return Math.max(
    minReachFade,
    1 - Math.max(0, reach - reachFadeFrom) / reachFadeSpan,
  );
}

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
