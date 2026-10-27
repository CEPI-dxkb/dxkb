/**
 * The Compare Region Viewer's zoom math: the wheel step, the limits the zoom
 * buttons disable at, the zoom slider's log scale and level text, and carrying
 * a zoom across a change of plot width (a density switch or a resize).
 * Zooming is horizontal only; `constrainToTrack` in `layout.ts` clamps it.
 */
import type { TransformMatrix } from "@visx/zoom";
import { constrainToTrack, maxZoom } from "./layout";

/** One click of the zoom buttons. */
export const zoomStep = 1.5;

/**
 * ⌘ + wheel zooms 20% a notch, horizontally only. Pass to `<Zoom wheelDelta>`.
 * Ctrl + wheel and a trackpad pinch never get here: use-gesture hands them to
 * Zoom as a pinch, which steps by Zoom's default `pinchDelta` (10% an event;
 * `constrainToTrack` keeps it horizontal). A pinch sends many small events,
 * so 20% there would be too fast. Its anchor at the pointer needs
 * `patches/@visx__zoom@4.0.0.patch`.
 */
export function wheelDelta(event: Pick<WheelEvent, "deltaY">): {
  scaleX: number;
  scaleY: number;
} {
  return { scaleX: event.deltaY < 0 ? 1.2 : 1 / 1.2, scaleY: 1 };
}

/**
 * Where the zoom stands: `canZoomOut` is false at the whole window (1×),
 * `canZoomIn` false at `maxZoom` (20×). `constrainToTrack` clamps to exactly
 * these, so the buttons disable at the limits instead of doing nothing.
 */
export function zoomLimits(matrix: Pick<TransformMatrix, "scaleX">): {
  level: number;
  maxZoom: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
} {
  const level = matrix.scaleX;
  return {
    level,
    maxZoom,
    canZoomIn: level < maxZoom - 1e-6,
    canZoomOut: level > 1 + 1e-6,
  };
}

/**
 * The zoom matrix for a plot `toWidth` px wide that shows what `matrix`
 * showed in one `fromWidth` px wide: the same zoom level and the same visible
 * bp range (the translation is in pixels, so it scales with the width).
 */
export function carryMatrix(
  matrix: TransformMatrix,
  fromWidth: number,
  toWidth: number,
): TransformMatrix {
  const next = {
    ...matrix,
    translateX: fromWidth > 0 ? (matrix.translateX * toWidth) / fromWidth : 0,
  };
  return constrainToTrack(next, next, toWidth);
}

/** The zoom slider's position, 0–100. It runs on log(zoom), so each notch feels like the same step. */
export function zoomSliderValue(level: number, max: number): number {
  return Math.round((Math.log(level) / Math.log(max)) * 1000) / 10;
}

/** "1.5×", or a whole "10×" from 9.95 up. */
export function formatZoomLevel(level: number): string {
  return `${level < 9.95 ? level.toFixed(1) : String(Math.round(level))}×`;
}
