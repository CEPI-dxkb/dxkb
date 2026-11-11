import type { PopupBox } from "@/lib/popup-placement";

export const featurePopupGap = 6;
export const featureCardMinRoom = 360;

/**
 * Null while the glyph is scrolled or zoomed away, or under the label column or
 * ruler, so its popup hides rather than floating over another gene.
 */
export function glyphInView(glyph: PopupBox, plot: PopupBox): PopupBox | null {
  const left = Math.max(glyph.left, plot.left);
  const right = Math.min(glyph.right, plot.right);
  const middle = (glyph.top + glyph.bottom) / 2;
  if (right <= left || middle < plot.top || middle > plot.bottom) return null;
  return { left, top: glyph.top, right, bottom: glyph.bottom };
}
