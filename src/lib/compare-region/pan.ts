/**
 * While a drag pans, the track's layers keep the geometry they were drawn at
 * and slide by one transform per frame; they are drawn again once the drag has
 * used up `panReach`, and when it ends.
 */
import type { TrackMatrix } from "./ruler";

export function panReach(plotWidth: number): number {
  return plotWidth;
}

export function heldPanMatrix<Matrix extends TrackMatrix>(
  held: Matrix | null,
  matrix: Matrix,
  dragging: boolean,
  plotWidth: number,
): Matrix | null {
  if (!dragging) return null;
  if (
    held &&
    held.scaleX === matrix.scaleX &&
    Math.abs(matrix.translateX - held.translateX) <= panReach(plotWidth)
  ) {
    return held;
  }
  return matrix;
}
