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
 * Everything here is in base pairs, apart from `constrainToTrack`, which
 * clamps the zoom in pixels. Zooming only changes the x scale, so a layout is
 * computed once per answer; the pixel geometry of rows and glyphs is in
 * `figure-frame.ts` and `glyph-paths.ts`.
 */
import type { TransformMatrix } from "@visx/zoom";
import type { CompareRegionFeature, CompareRegionRow } from "./contract";

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
 * When that leaves the matrix as it was, `prev` itself comes back.
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
  // Nothing moves (a drag at 1× or against an end, a zoom at its limit): the
  // same object back, so Zoom's state is unchanged and nothing re-renders.
  if (
    prev.scaleX === scaleX &&
    prev.translateX === translateX &&
    prev.scaleY === 1 &&
    prev.translateY === 0 &&
    prev.skewX === 0 &&
    prev.skewY === 0
  ) {
    return prev;
  }
  return { scaleX, scaleY: 1, translateX, translateY: 0, skewX: 0, skewY: 0 };
}
