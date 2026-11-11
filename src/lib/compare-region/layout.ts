import type { TransformMatrix } from "@visx/zoom";
import type { CompareRegionFeature, CompareRegionRow } from "./contract";

export const maxZoom = 20;

export interface PlacedFeature {
  feature: CompareRegionFeature;
  from: number;
  to: number;
  lane: number;
}

export interface PlacedRow {
  row: CompareRegionRow;
  firstLane: number;
  laneCount: number;
  features: PlacedFeature[];
  /** In a mirrored row this runs right to left, so `baselineFrom` exceeds `baselineTo`. */
  baselineFrom: number;
  baselineTo: number;
  contigStartShown: boolean;
  contigEndShown: boolean;
}

export interface CompareRegionLayout {
  rows: PlacedRow[];
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
 * The pinned gene goes first, then BLAST hits, then the rest, so it keeps lane
 * 0 even when an earlier neighbor overlaps it.
 */
function packLanes(
  features: PlacedFeature[],
  pinnedFid: string,
): PlacedFeature[] {
  const rank = (item: PlacedFeature) => {
    if (item.feature.fid === pinnedFid) return 0;
    return item.feature.type === "blast" ? 1 : 2;
  };
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
 * When the scale is clamped, the step from `prev` to `next` is cut short by the
 * same fraction, which keeps the content under the zoom point still.
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
  // The same object back, so Zoom's state is unchanged and nothing re-renders.
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
