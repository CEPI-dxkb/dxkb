import type { TransformMatrix } from "@visx/zoom";
import { constrainToTrack, maxZoom } from "./layout";

export const zoomStep = 1.5;

/**
 * Ctrl + wheel and a trackpad pinch never get here: use-gesture hands them to
 * Zoom as a pinch. The pointer anchor needs `patches/@visx__zoom@4.0.0.patch`.
 */
export function wheelDelta(event: Pick<WheelEvent, "deltaY">): {
  scaleX: number;
  scaleY: number;
} {
  return { scaleX: event.deltaY < 0 ? 1.2 : 1 / 1.2, scaleY: 1 };
}

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

export function zoomSliderValue(level: number, max: number): number {
  return Math.round((Math.log(level) / Math.log(max)) * 1000) / 10;
}

export function formatZoomLevel(level: number): string {
  return `${level < 9.95 ? level.toFixed(1) : String(Math.round(level))}×`;
}
