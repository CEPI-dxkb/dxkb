/**
 * Where a gene's popups go: the hover tooltip and the pinned feature card
 * both hang from the gene's glyph, not from the pointer. Each opens just
 * below and right of the glyph; left of it where the right lacks room, and
 * above it where below does. Boxes are in the chart root's coordinates.
 */

/** A box in the chart root's coordinates, px. */
export interface PopupBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** From the glyph to the popup, px, across and down. */
export const featurePopupGap = 6;
/** A popup keeps this far inside its bounds, px. */
const featurePopupMargin = 8;
/**
 * Room enough on one side of the gene for the card's lines and a fair part
 * of its details, px: the card takes that side even if its details then
 * scroll.
 */
export const featureCardMinRoom = 360;

/**
 * The widest a popup may be in a root `width` px wide: the root less its
 * margins. A phone's chart is narrower than the card (24rem) or the tooltip
 * (20rem); capped, they fit inside it, so the clamp in `placeFeaturePopup`
 * keeps all of them in view, the card's Collapse and Close buttons included.
 */
export function featurePopupMaxWidth(width: number): number {
  return Math.max(0, width - 2 * featurePopupMargin);
}

/**
 * Where a popup may go: the root's width, and from the top of the figure (so
 * the command bar and the strip stay in reach) to the root's bottom.
 */
export interface FeaturePopupBounds {
  width: number;
  top: number;
  bottom: number;
}

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

/**
 * Which side of the glyph the popup opens on, and the room there (the card's
 * height limit): below while `need` fits below, above while it fits above,
 * else the roomier side.
 */
export function featurePopupSide(
  glyph: PopupBox,
  bounds: FeaturePopupBounds,
  need: number,
): { below: boolean; room: number } {
  const roomBelow =
    bounds.bottom - featurePopupMargin - (glyph.bottom + featurePopupGap);
  const roomAbove =
    glyph.top - featurePopupGap - (bounds.top + featurePopupMargin);
  const below =
    roomBelow >= need || (roomAbove < need && roomBelow >= roomAbove);
  return { below, room: Math.max(0, below ? roomBelow : roomAbove) };
}

function clampInto(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(value, high));
}

export interface FeaturePopupPlacement {
  /** The glyph's part in view (`glyphInView`). */
  glyph: PopupBox;
  /** The popup's size as drawn. */
  size: { width: number; height: number };
  bounds: FeaturePopupBounds;
  /** `featurePopupSide`'s side. */
  below: boolean;
}

/**
 * The popup's top-left corner: right of the glyph, else left of it, else
 * (a gene wider than the room beside it) under its left end; below the glyph
 * or above it, by `below`; kept inside `bounds`.
 */
export function placeFeaturePopup({
  glyph,
  size,
  bounds,
  below,
}: FeaturePopupPlacement): { x: number; y: number } {
  const rightX = glyph.right + featurePopupGap;
  const leftX = glyph.left - featurePopupGap - size.width;
  let x = glyph.left;
  if (rightX + size.width <= bounds.width - featurePopupMargin) x = rightX;
  else if (leftX >= featurePopupMargin) x = leftX;
  const y = below
    ? glyph.bottom + featurePopupGap
    : glyph.top - featurePopupGap - size.height;
  return {
    x: clampInto(
      x,
      featurePopupMargin,
      bounds.width - size.width - featurePopupMargin,
    ),
    y: clampInto(
      y,
      bounds.top + featurePopupMargin,
      bounds.bottom - size.height - featurePopupMargin,
    ),
  };
}
