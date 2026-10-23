/**
 * Where everything in the Compare Region Viewer goes, as pure functions of the
 * route's rows. It is React-free, so tests need no DOM.
 *
 * Every row is aligned on its pinned gene: positions become offsets (bp) from
 * the row's `center`. A row whose pinned gene runs on the other strand from
 * the focus gene is mirrored, so homologs line up and point the same way. The
 * x axis spans the focus row's window. This is legacy BV-BRC's layout
 * (`CompareRegionViewer.js` `render`, from myRAST's RegionPanel.pm).
 *
 * Everything here is in base pairs except `glyphPath`, which takes pixels.
 * Zooming only changes the x scale, so a layout is computed once per answer.
 */
import type { TransformMatrix } from "@visx/zoom";
import type { CompareRegionFeature, CompareRegionRow } from "./contract";

/** Legacy's sizes, px. */
export const laneHeight = 30;
export const topMargin = 20;
/** Half an arrow head's height (and a box's); an arrow's body is 65% of it. */
export const glyphHalfHeight = 10;
const arrowHeadLength = 15;
/** At 10 kb over ~1,000 px, 20× is about half a base per pixel. */
export const maxZoom = 20;

export interface PlacedFeature {
  feature: CompareRegionFeature;
  /** 5′ end, as an offset from the row's center in the focus gene's orientation. */
  from: number;
  /** 3′ end: where an arrow points. */
  to: number;
  /** Lane within the row, 0 first. */
  lane: number;
}

export interface PlacedRow {
  row: CompareRegionRow;
  /** The row's first lane, counted over the whole chart. */
  firstLane: number;
  laneCount: number;
  /** The row's features, in the row's order. */
  features: PlacedFeature[];
  /**
   * Offsets of the part of the window the contig covers: where the baseline
   * runs, from the contig's start side to its end side. In a mirrored row
   * that runs right to left, so `baselineFrom` exceeds `baselineTo`.
   */
  baselineFrom: number;
  baselineTo: number;
  /** The window runs past the contig's first / last base, so that end gets a tick. */
  contigStartShown: boolean;
  contigEndShown: boolean;
}

export interface CompareRegionLayout {
  rows: PlacedRow[];
  /** The offsets the x axis spans. */
  domain: [number, number];
  laneCount: number;
}

function low(item: PlacedFeature): number {
  return Math.min(item.from, item.to);
}

function high(item: PlacedFeature): number {
  return Math.max(item.from, item.to);
}

/**
 * First-fit lanes, placing the pinned gene first, then BLAST hits, then
 * everything else, each group in the service's order. The service sends
 * features in contig order, which legacy packed as is, so in a mirrored row
 * they come right to left on screen. Taking the pinned gene first keeps it in
 * lane 0, with its hit directly below, even when a neighbor sent before it
 * overlaps it by a few bases. Touching features share a lane. Features keep
 * their input order; only `lane` is set.
 */
function packLanes(
  features: PlacedFeature[],
  pinnedFid: string,
): PlacedFeature[] {
  const rank = (item: PlacedFeature) => {
    if (item.feature.fid === pinnedFid) return 0;
    return item.feature.type === "blast" ? 1 : 2;
  };
  // A stable sort: within a group, the service's order.
  const ordered = [...features].sort((a, b) => rank(a) - rank(b));
  const lanes: [number, number][][] = [];
  const laneOf = new Map<PlacedFeature, number>();
  for (const item of ordered) {
    const lo = low(item);
    const hi = high(item);
    let lane = lanes.findIndex((spans) =>
      spans.every(([start, end]) => hi <= start || lo >= end),
    );
    if (lane === -1) {
      lane = lanes.length;
      lanes.push([[lo, hi]]);
    } else {
      lanes[lane].push([lo, hi]);
    }
    laneOf.set(item, lane);
  }
  return features.map((item) => ({ ...item, lane: laneOf.get(item) ?? 0 }));
}

export function layoutCompareRegion(
  rows: readonly CompareRegionRow[],
): CompareRegionLayout {
  const focus = rows.at(0);
  if (!focus) return { rows: [], domain: [0, 1], laneCount: 0 };
  let nextLane = 0;
  const placed = rows.map((row): PlacedRow => {
    const mirror = row.pinnedStrand !== focus.pinnedStrand;
    const toOffset = (position: number) =>
      mirror ? row.center - position : position - row.center;
    const features = packLanes(
      row.features.map((feature) => ({
        feature,
        from: toOffset(feature.start),
        to: toOffset(feature.end),
        lane: 0,
      })),
      row.pinnedFid,
    );
    const laneCount = Math.max(1, ...features.map((item) => item.lane + 1));
    const contigEnd =
      row.contigLength !== null && row.end > row.contigLength
        ? row.contigLength
        : null;
    const placedRow: PlacedRow = {
      row,
      firstLane: nextLane,
      laneCount,
      features,
      baselineFrom: toOffset(Math.max(row.start, 0)),
      baselineTo: toOffset(contigEnd ?? row.end),
      contigStartShown: row.start < 0,
      contigEndShown: contigEnd !== null,
    };
    nextLane += laneCount;
    return placedRow;
  });
  return {
    rows: placed,
    domain: [focus.start - focus.center, focus.end - focus.center],
    laneCount: nextLane,
  };
}

export type GlyphShape = "arrow" | "pill" | "bar" | "box";

/**
 * Legacy's shapes: genes are arrows, BLAST hits thin pills, pseudogenes thin
 * bars, anything else (tRNA, repeats, assembly gaps) a box.
 */
export function glyphShape(type: string): GlyphShape {
  if (type === "peg" || type === "domain_hit") return "arrow";
  if (type === "blast") return "pill";
  if (type === "pseudogene") return "bar";
  return "box";
}

/** An SVG path from commands and numbers, numbers rounded to 0.1 px. */
function path(parts: (string | number)[]): string {
  return parts
    .map((part) => (typeof part === "number" ? Math.round(part * 10) / 10 : part))
    .join(" ");
}

function rectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): string {
  const rx = Math.min(radius, width / 2);
  if (rx <= 0) return path(["M", x, y, "h", width, "v", height, "h", -width, "Z"]);
  // Elliptical caps: between ends `height` apart, SVG scales a circular
  // arc's radius up to `height / 2`, which widens a narrow pill into a circle.
  const ry = height / 2;
  const straight = width - 2 * rx;
  return path([
    "M", x + rx, y,
    "h", straight,
    "a", rx, ry, 0, 0, 1, 0, height,
    "h", -straight,
    "a", rx, ry, 0, 0, 1, 0, -height,
    "Z",
  ]);
}

/**
 * The path of one glyph centered on y = 0, from pixel `x1` (the 5′ end) to
 * `x2` (the 3′ end). An arrow's head is 15 px long, or the whole glyph when
 * the feature is shorter.
 */
export function glyphPath(shape: GlyphShape, x1: number, x2: number): string {
  const h = glyphHalfHeight;
  if (shape === "arrow") {
    if (Math.abs(x2 - x1) <= arrowHeadLength) {
      return path(["M", x1, -h, "L", x2, 0, "L", x1, h, "Z"]);
    }
    const neck = x2 > x1 ? x2 - arrowHeadLength : x2 + arrowHeadLength;
    const body = Math.round(0.65 * h);
    return path([
      "M", x1, -body,
      "L", neck, -body,
      "L", neck, -h,
      "L", x2, 0,
      "L", neck, h,
      "L", neck, body,
      "L", x1, body,
      "Z",
    ]);
  }
  const half = shape === "box" ? h : h / 2;
  return rectPath(
    Math.min(x1, x2),
    -half,
    Math.abs(x2 - x1),
    2 * half,
    shape === "pill" ? half : 0,
  );
}

/**
 * `@visx/zoom`'s `constrain`, called with the requested and the current
 * matrix: horizontal only, never zoomed out past the whole window or in past
 * `maxZoom`, and never panned past the window's ends. It replaces Zoom's own
 * scale check, which keeps `prev` when the scale is out of range.
 *
 * A zoom about a point (the pointer, or the center for the zoom buttons)
 * moves `translateX` in proportion to `scaleX`. So when the scale is clamped,
 * the step from `prev` to `next` is cut short by the same fraction, which
 * keeps the content under that point still instead of sliding the view.
 */
export function constrainToTrack(
  next: TransformMatrix,
  prev: TransformMatrix,
  plotWidth: number,
): TransformMatrix {
  const scaleX = Math.min(Math.max(next.scaleX, 1), maxZoom);
  const step = next.scaleX - prev.scaleX;
  const anchoredX =
    scaleX === next.scaleX || step === 0
      ? next.translateX
      : prev.translateX +
        ((next.translateX - prev.translateX) * (scaleX - prev.scaleX)) / step;
  const translateX = Math.min(
    0,
    Math.max(plotWidth * (1 - scaleX), anchoredX),
  );
  return { scaleX, scaleY: 1, translateX, translateY: 0, skewX: 0, skewY: 0 };
}
