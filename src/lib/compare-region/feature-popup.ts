/**
 * Where a gene's popups go: the hover tooltip and the pinned feature card
 * both hang from the gene's glyph, not from the pointer. Each opens just
 * below and right of the glyph; left of it where the right lacks room, and
 * above it where below does (`@/lib/popup-placement`, which the Circular
 * Viewer's tooltip shares). Boxes are in the chart root's coordinates.
 */
import type { PopupBox } from "@/lib/popup-placement";

/** From the glyph to the popup, px, across and down. */
export const featurePopupGap = 6;
/**
 * Room enough on one side of the gene for the card's lines and a fair part
 * of its details, px: the card takes that side even if its details then
 * scroll.
 */
export const featureCardMinRoom = 360;

/**
 * The part of the glyph in view, clipped across to the plot, which is the
 * part past the sticky label column and under the sticky ruler. Null while
 * the glyph is scrolled or zoomed away, or under the label column or the
 * ruler, so its popup hides rather than float over another gene.
 */
export function glyphInView(glyph: PopupBox, plot: PopupBox): PopupBox | null {
  const left = Math.max(glyph.left, plot.left);
  const right = Math.min(glyph.right, plot.right);
  const middle = (glyph.top + glyph.bottom) / 2;
  if (right <= left || middle < plot.top || middle > plot.bottom) return null;
  return { left, top: glyph.top, right, bottom: glyph.bottom };
}
