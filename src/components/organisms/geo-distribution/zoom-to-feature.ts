import { geoNaturalEarth1, geoPath, type GeoProjection } from "@visx/vendor/d3-geo";
import { interpolateZoom } from "@visx/vendor/d3-interpolate";
import type { TransformMatrix } from "@visx/zoom";

import { countryGapFactor, countryReachScale } from "./map-constants";

export type Bounds = [[number, number], [number, number]];

export interface Viewport {
  width: number;
  height: number;
}

export interface ZoomLimits {
  minScale: number;
  maxScale: number;
}

// An absolute matrix (not a delta) that centres `bounds` in the viewport at the largest
// uniform scale that keeps `padding` free on each side, clamped to the zoom limits.
export function fitTransform(
  bounds: Bounds,
  viewport: Viewport,
  options: ZoomLimits & { padding: number },
): TransformMatrix {
  const [[x0, y0], [x1, y1]] = bounds;
  const fit = Math.min(
    (viewport.width * (1 - 2 * options.padding)) / Math.max(x1 - x0, 1e-6),
    (viewport.height * (1 - 2 * options.padding)) / Math.max(y1 - y0, 1e-6),
  );
  const scale = Math.min(Math.max(fit, options.minScale), options.maxScale);
  return {
    scaleX: scale,
    scaleY: scale,
    skewX: 0,
    skewY: 0,
    translateX: viewport.width / 2 - (scale * (x0 + x1)) / 2,
    translateY: viewport.height / 2 - (scale * (y0 + y1)) / 2,
  };
}

export interface RingBox {
  area: number;
  bounds: Bounds;
}

function ringBox(points: [number, number][]): RingBox {
  let area = 0;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  points.forEach(([x, y], index) => {
    const [nextX, nextY] = points[(index + 1) % points.length];
    area += x * nextY - nextX * y;
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  });
  return { area: Math.abs(area) / 2, bounds: [[x0, y0], [x1, y1]] };
}

const noop = (): void => undefined;

// The rings d3 actually draws: after its antimeridian clip, so Chukotka and east Fiji are
// rings of their own instead of a box that spans the map.
function projectedRingBoxes(
  projection: GeoProjection,
  feature: GeoJSON.Feature,
): RingBox[] {
  const rings: [number, number][][] = [];
  const context = {
    beginPath: noop,
    closePath: noop,
    arc: noop,
    moveTo(x: number, y: number) {
      rings.push([[x, y]]);
    },
    lineTo(x: number, y: number) {
      rings.at(-1)?.push([x, y]);
    },
  };
  geoPath(projection, context)(feature);
  return rings.map(ringBox);
}

function gapBetween(a: Bounds, b: Bounds): number {
  const dx = Math.max(0, a[0][0] - b[1][0], b[0][0] - a[1][0]);
  const dy = Math.max(0, a[0][1] - b[1][1], b[0][1] - a[1][1]);
  return Math.hypot(dx, dy);
}

function unionOf(a: Bounds, b: Bounds): Bounds {
  return [
    [Math.min(a[0][0], b[0][0]), Math.min(a[0][1], b[0][1])],
    [Math.max(a[1][0], b[1][0]), Math.max(a[1][1], b[1][1])],
  ];
}

// The biggest ring plus every ring chained to it within `reach`, so an overseas territory
// (French Guiana) is dropped while an archipelago (Indonesia, Malaysia) is kept.
export function mainLandmassBounds(
  rings: RingBox[],
  reach: (lead: RingBox) => number,
): Bounds | null {
  const sorted = [...rings].sort((a, b) => b.area - a.area);
  const lead = sorted.at(0);
  if (!lead) return null;
  const maxGap = reach(lead);
  let box = lead.bounds;
  let rest = sorted.slice(1);
  let grew = true;
  while (grew) {
    grew = false;
    const absorbed = rest.filter((candidate) => gapBetween(box, candidate.bounds) <= maxGap);
    if (absorbed.length > 0) {
      grew = true;
      box = absorbed.reduce((acc, candidate) => unionOf(acc, candidate.bounds), box);
      rest = rest.filter((candidate) => !absorbed.includes(candidate));
    }
  }
  return box;
}

export function countryBounds(
  projection: GeoProjection,
  feature: GeoJSON.Feature,
): Bounds | null {
  const maxReach = countryReachScale * projection.scale();
  return mainLandmassBounds(projectedRingBoxes(projection, feature), (lead) => {
    const longestSide = Math.max(
      lead.bounds[1][0] - lead.bounds[0][0],
      lead.bounds[1][1] - lead.bounds[0][1],
    );
    return Math.min(countryGapFactor * longestSide, maxReach);
  });
}

// The scale the World layer draws at (WorldCountriesLayer's <NaturalEarth scale>), shared
// here so the layer and a programmatic zoom use one scale. The translate is not shared:
// `[width / 2, height / 2]` is written in WorldCountriesLayer and again below, and the
// click-vs-handle parity tests in choropleth-svg-zoom.test.tsx are what keep the two
// projections from drifting apart.
export function worldMapScale(width: number, height: number): number {
  return Math.min(width / 6.3, height * 0.29);
}

// The projection <NaturalEarth scale translate> builds for the World layer: the same
// projection a click on a country measures with (see the note above on what guards it).
export function worldProjection(width: number, height: number): GeoProjection {
  return geoNaturalEarth1()
    .scale(worldMapScale(width, height))
    .translate([width / 2, height / 2]);
}

function clampScale(value: number, limits: ZoomLimits): number {
  return Math.min(Math.max(value, limits.minScale), limits.maxScale);
}

// Reads only scaleX: assumes the uniform scale and zero skew every matrix in this feature has.
function toView(matrix: TransformMatrix, viewport: Viewport): [number, number, number] {
  const scale = matrix.scaleX;
  return [
    (viewport.width / 2 - matrix.translateX) / scale,
    (viewport.height / 2 - matrix.translateY) / scale,
    viewport.width / scale,
  ];
}

export function zoomTransformAt(
  from: TransformMatrix,
  to: TransformMatrix,
  viewport: Viewport,
  limits: ZoomLimits,
): (t: number) => TransformMatrix {
  const path = interpolateZoom(toView(from, viewport), toView(to, viewport));
  return (t) => {
    if (t <= 0) return from;
    if (t >= 1) return to;
    const [cx, cy, size] = path(t);
    const scale = clampScale(viewport.width / size, limits);
    return {
      scaleX: scale,
      scaleY: scale,
      skewX: 0,
      skewY: 0,
      translateX: viewport.width / 2 - scale * cx,
      translateY: viewport.height / 2 - scale * cy,
    };
  };
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export interface AnimateOptions {
  from: TransformMatrix;
  to: TransformMatrix;
  viewport: Viewport;
  limits: ZoomLimits;
  durationMs: number;
  apply: (matrix: TransformMatrix) => void;
  requestFrame?: (callback: (time: number) => void) => number;
  cancelFrame?: (handle: number) => void;
  now?: () => number;
}

export function animateTransform(options: AnimateOptions): () => void {
  const { from, to, viewport, limits, durationMs, apply } = options;
  if (durationMs <= 0) {
    apply(to);
    return noop;
  }
  const requestFrame = options.requestFrame ?? ((cb) => window.requestAnimationFrame(cb));
  const cancelFrame =
    options.cancelFrame ??
    ((handle) => {
      window.cancelAnimationFrame(handle);
    });
  const now = options.now ?? (() => window.performance.now());
  const at = zoomTransformAt(from, to, viewport, limits);
  const start = now();
  let handle = 0;
  let cancelled = false;
  // A call, not the variable: `apply` may cancel mid-tick, which TypeScript's narrowing of
  // `cancelled` after the early return above cannot see.
  const isCancelled = (): boolean => cancelled;
  const tick = () => {
    if (isCancelled()) return;
    const progress = Math.min((now() - start) / durationMs, 1);
    apply(at(easeInOutCubic(progress)));
    if (progress < 1 && !isCancelled()) handle = requestFrame(tick);
  };
  handle = requestFrame(tick);
  return () => {
    cancelled = true;
    cancelFrame(handle);
  };
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
