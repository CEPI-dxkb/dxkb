/**
 * Panning the Compare Region Viewer without drawing it again. A drag only
 * moves the zoom's `translateX`, which shifts every glyph, ribbon and baseline
 * by the same pixels. So while a drag pans, the track's layers keep the
 * geometry they were drawn at when it began (the held matrix), drawn
 * `panReach` past either edge of the plot, and slide by the difference: one
 * transform a frame instead of thousands of outlines. They are drawn again
 * once the drag has used up that reach, and when it ends.
 */
import type { TrackMatrix } from "./ruler";

/**
 * How far past either edge of the plot the layers are drawn while a drag
 * pans, px: a plot's width, about as far as one sweep of the pointer moves.
 */
export function panReach(plotWidth: number): number {
  return plotWidth;
}

/**
 * The matrix the layers are drawn at while a drag pans: `held` (the one it
 * began at) while what was drawn still covers the plot, else the zoom's own
 * `matrix`, which is held from then on. Null at rest, when the layers follow
 * the zoom; a zoom during the drag is drawn at once.
 */
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
