import type { CircularContig, CircularFeature } from "./contract";
import { heatmapColor } from "./heatmap";
import { indexSpans, spanAt, visibleSegments, type IndexedSpan, type SpanIndex } from "./hit-test";
import {
  fullTurn,
  layoutRings,
  offsetAngle,
  toCartesian,
  type GenomeLayout,
  type PolarPoint,
  type Ring,
} from "./layout";
import {
  baselineRadius,
  gridRadii,
  polylinesPath,
  radialSectorsPath,
  scoreRadius,
  sectorsPath,
  type RadialPoint,
  type RadialSpan,
  type ScoreScale,
} from "./paths";
import { positionTicks } from "./ticks";
import type { ScorePoint, TrackItems } from "./track-items";
import type { CircularTrack } from "./tracks";
import type { UserTrackItem } from "./user-track";

export type TrackData =
  | { status: "pending" }
  | { status: "error"; error: Error }
  | { status: "ready"; items: TrackItems };

export type HoverItem =
  | { kind: "feature"; feature: CircularFeature }
  | { kind: "contig"; contig: CircularContig }
  | { kind: "region"; region: UserTrackItem }
  | { kind: "score"; point: ScorePoint };

/**
 * `innerRadius` is the baseline, below `outerRadius` for a negative score (d3's
 * arc draws either way round).
 */
export type BarRadii = Pick<RadialSpan, "innerRadius" | "outerRadius">;

export interface TickMark {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label?: {
    x: number;
    y: number;
    rotate: number;
    anchor: "start" | "end";
    text: string;
  };
}

export type TrackBody =
  | { kind: "labels"; ticks: readonly TickMark[] }
  | {
      kind: "marks";
      layers: readonly { color: string | null; darkColor: string | null; d: string }[];
      hits: SpanIndex | null;
      items: readonly HoverItem[];
      bars?: readonly BarRadii[];
    }
  | { kind: "pending" }
  | { kind: "failed" };

export interface TrackDrawing {
  id: string;
  title: string;
  ring: Ring;
  visible: boolean;
  foreground: string | null;
  background: string | null;
  backgroundPath: string;
  grid: readonly number[];
  paint: "fill" | "stroke";
  body: TrackBody;
}

const defaultScale: ScoreScale = { min: 0, max: 1 };

export function ringPath(ring: Ring): string {
  return sectorsPath(
    [{ startAngle: 0, endAngle: fullTurn }],
    ring.innerRadius,
    ring.outerRadius,
  );
}

function regionSpans(
  layout: GenomeLayout,
  regions: readonly { accession: string; start: number; end: number }[],
): IndexedSpan[] {
  return regions.flatMap((region, index) => {
    const startAngle = offsetAngle(layout, region.accession, region.start);
    const endAngle = offsetAngle(layout, region.accession, region.end);
    return startAngle === undefined || endAngle === undefined || startAngle >= endAngle
      ? []
      : [{ startAngle, endAngle, index }];
  });
}

function tickMarks(layout: GenomeLayout, ring: Ring): TickMark[] {
  const width = ring.outerRadius - ring.innerRadius;
  return positionTicks(layout).map((tick) => {
    const reach =
      ring.innerRadius + (tick.size === "minor" ? width / 10 : width / 5);
    const from = toCartesian(tick.angle, ring.innerRadius);
    const to = toCartesian(tick.angle, reach);
    const mark: TickMark = { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
    if (tick.label === undefined) return mark;
    const at = toCartesian(tick.angle, reach + 2);
    const degrees = (tick.angle * 180) / Math.PI - 90;
    const flipped = tick.angle > Math.PI;
    return {
      ...mark,
      label: {
        x: at.x,
        y: at.y,
        rotate: flipped ? degrees + 180 : degrees,
        anchor: flipped ? "end" : "start",
        text: tick.label,
      },
    };
  });
}

function sectionBody(
  track: CircularTrack,
  items: Exclude<TrackItems, { kind: "scores" }>,
  layout: GenomeLayout,
  ring: Ring,
): TrackBody {
  let regions: { accession: string; start: number; end: number }[];
  let hover: HoverItem[];
  if (items.kind === "contigs") {
    regions = items.contigs.map((contig) => ({
      accession: contig.accession,
      start: 0,
      end: contig.length,
    }));
    hover = items.contigs.map((contig) => ({ kind: "contig", contig }));
  } else if (items.kind === "features") {
    regions = items.features.map((feature) => ({
      accession: feature.accession,
      start: feature.start - 1,
      end: feature.end,
    }));
    hover = items.features.map((feature) => ({ kind: "feature", feature }));
  } else {
    regions = items.regions.map((region) => ({
      accession: region.accession,
      start: region.start - 1,
      end: region.end,
    }));
    hover = items.regions.map((region) => ({ kind: "region", region }));
  }
  const spans = regionSpans(layout, regions);
  return {
    kind: "marks",
    layers: [
      {
        color: track.foreground,
        darkColor: track.darkForeground,
        d: sectorsPath(spans, ring.innerRadius, ring.outerRadius),
      },
    ],
    hits: indexSpans(spans),
    items: hover,
  };
}

function scoreBody(
  track: CircularTrack,
  points: readonly ScorePoint[],
  layout: GenomeLayout,
  ring: Ring,
): TrackBody {
  const scale = track.scale ?? defaultScale;
  const { innerRadius, outerRadius } = ring;
  if (track.plot === "line") {
    const lines = new Map<string, RadialPoint[]>();
    for (const point of points) {
      const contig = layout.byAccession.get(point.accession);
      // A 0-based start at or past the sequence's end has no base to stand on
      // (`offsetAngle` would clamp it to a vertex at the end).
      if (contig === undefined || point.start >= contig.length) continue;
      const angle = contig.startAngle + point.start * layout.radiansPerBase;
      const line = lines.get(point.accession) ?? [];
      line.push({
        angle,
        radius: scoreRadius(point.score, scale, innerRadius, outerRadius),
      });
      lines.set(point.accession, line);
    }
    return {
      kind: "marks",
      layers: [
        {
          color: track.foreground,
          darkColor: track.darkForeground,
          d: polylinesPath(lines.values()),
        },
      ],
      hits: null,
      items: [],
    };
  }
  const spans = regionSpans(layout, points);
  const hover: HoverItem[] = points.map((point) => ({ kind: "score", point }));
  if (track.plot === "histogram") {
    const baseline = baselineRadius(scale, innerRadius, outerRadius);
    const bars = points.map((point) => ({
      innerRadius: baseline,
      outerRadius: scoreRadius(point.score, scale, innerRadius, outerRadius),
    }));
    const d = radialSectorsPath(
      spans.map((span) => ({ ...span, ...bars[span.index] })),
    );
    return {
      kind: "marks",
      layers: [{ color: track.foreground, darkColor: track.darkForeground, d }],
      hits: indexSpans(spans),
      items: hover,
      bars,
    };
  }
  // The hits keep whole spans for the keyboard and its count; only the paint is
  // cut into the pieces that show.
  const hits = indexSpans(spans);
  const byColor = new Map<string, IndexedSpan[]>();
  for (const segment of visibleSegments(hits)) {
    const color = heatmapColor(points[segment.index].score, scale.max);
    const group = byColor.get(color) ?? [];
    group.push(segment);
    byColor.set(color, group);
  }
  return {
    kind: "marks",
    layers: [...byColor].map(([color, group]) => ({
      color,
      darkColor: null,
      d: sectorsPath(group, innerRadius, outerRadius),
    })),
    hits,
    items: hover,
  };
}

function buildTrackDrawing(
  track: CircularTrack,
  data: TrackData | undefined,
  layout: GenomeLayout,
  ring: Ring,
): TrackDrawing {
  const base = {
    id: track.id,
    title: track.title,
    ring,
    visible: track.visible,
    foreground: track.foreground,
    background: track.background,
    backgroundPath:
      track.background === null
        ? ""
        : sectorsPath(layout.contigs, ring.innerRadius, ring.outerRadius),
    grid:
      track.plot === "line" || track.plot === "histogram"
        ? gridRadii(ring.innerRadius, ring.outerRadius)
        : [],
    paint: track.plot === "line" ? ("stroke" as const) : ("fill" as const),
  };
  if (track.plot === "labels") {
    return { ...base, body: { kind: "labels", ticks: tickMarks(layout, ring) } };
  }
  if (data === undefined || data.status === "pending") {
    return { ...base, body: { kind: "pending" } };
  }
  if (data.status === "error") return { ...base, body: { kind: "failed" } };
  const { items } = data;
  return {
    ...base,
    body:
      items.kind === "scores"
        ? scoreBody(track, items.points, layout, ring)
        : sectionBody(track, items, layout, ring),
  };
}

export const pendingTrackData: TrackData = { status: "pending" };

function drawsAlike(a: TrackData | undefined, b: TrackData | undefined): boolean {
  const left = a ?? pendingTrackData;
  const right = b ?? pendingTrackData;
  if (left === right) return true;
  if (left.status === "ready" || right.status === "ready") {
    return left.status === "ready" && right.status === "ready" && left.items === right.items;
  }
  return left.status === right.status;
}

interface CachedDrawing {
  track: CircularTrack;
  data: TrackData | undefined;
  layout: GenomeLayout;
  ring: Ring;
  drawing: TrackDrawing;
}

export interface DrawingCache {
  readonly entries: Map<string, CachedDrawing>;
}

export function createDrawingCache(): DrawingCache {
  return { entries: new Map() };
}

export function buildTrackDrawings(
  tracks: readonly CircularTrack[],
  data: ReadonlyMap<string, TrackData>,
  layout: GenomeLayout,
  outerRadius: number,
  cache?: DrawingCache,
): TrackDrawing[] {
  const rings = layoutRings(tracks, outerRadius);
  const drawings = tracks.map((track, index) => {
    const ring = rings[index];
    const answer = data.get(track.id);
    const cached = cache?.entries.get(track.id);
    if (
      cached !== undefined &&
      cached.track === track &&
      cached.layout === layout &&
      cached.ring.innerRadius === ring.innerRadius &&
      cached.ring.outerRadius === ring.outerRadius &&
      drawsAlike(cached.data, answer)
    ) {
      return { track, data: answer, layout, ring: cached.ring, drawing: cached.drawing };
    }
    return { track, data: answer, layout, ring, drawing: buildTrackDrawing(track, answer, layout, ring) };
  });
  if (cache) {
    cache.entries.clear();
    for (const entry of drawings) cache.entries.set(entry.track.id, entry);
  }
  return drawings.map((entry) => entry.drawing);
}

export interface FigureHit {
  trackId: string;
  item: HoverItem;
  path: string;
}

function highlightReach({ innerRadius: baseline, outerRadius: reach }: BarRadii): number {
  return reach < baseline ? Math.min(reach, baseline - 1) : Math.max(reach, baseline + 1);
}

export function spanHit(
  drawing: TrackDrawing,
  items: readonly HoverItem[],
  span: IndexedSpan,
): FigureHit {
  const { ring, body } = drawing;
  const bar = body.kind === "marks" ? body.bars?.[span.index] : undefined;
  return {
    trackId: drawing.id,
    item: items[span.index],
    path:
      bar === undefined
        ? sectorsPath([span], ring.innerRadius, ring.outerRadius)
        : sectorsPath([span], bar.innerRadius, highlightReach(bar)),
  };
}

export function hitTest(
  drawings: readonly TrackDrawing[],
  point: PolarPoint,
  tolerancePx = 2,
): FigureHit | null {
  if (point.radius <= 0) return null;
  for (const drawing of drawings) {
    const { ring, body } = drawing;
    if (!drawing.visible || body.kind !== "marks" || body.hits === null) {
      continue;
    }
    if (point.radius < ring.innerRadius || point.radius > ring.outerRadius) {
      continue;
    }
    const span = spanAt(body.hits, point.angle, tolerancePx / point.radius);
    if (span === undefined) continue;
    return spanHit(drawing, body.items, span);
  }
  return null;
}
