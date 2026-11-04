/**
 * Where a popup goes beside the thing it describes: the Compare Region's
 * hover tooltip and feature card (hung from a gene's glyph) and the Circular
 * Viewer's tooltip (hung from the pointer, a zero-size box). A popup opens
 * just below and right of the box; left of it where the right lacks room, and
 * above it where below does. Boxes are in the bounds' coordinates.
 */

/** A box in the bounds' coordinates, px. */
export interface PopupBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A popup keeps this far inside its bounds, px. */
const popupMargin = 8;

/**
 * The widest a popup may be in bounds `width` px wide: the bounds less its
 * margins. A phone's figure is narrower than the Compare Region card (24rem)
 * or a tooltip; capped, they fit inside it, so the clamp in `placePopup`
 * keeps all of them in view.
 */
export function popupMaxWidth(width: number): number {
  return Math.max(0, width - 2 * popupMargin);
}

/**
 * Where a popup may go: the bounds' width, and from `top` (so a command bar
 * above stays in reach) to `bottom`.
 */
export interface PopupBounds {
  width: number;
  top: number;
  bottom: number;
}

/**
 * Which side of the box the popup opens on, and the room there (the card's
 * height limit): below while `need` fits below, above while it fits above,
 * else the roomier side. `gap` is the distance from the box to the popup.
 */
export function popupSide(
  box: PopupBox,
  bounds: PopupBounds,
  need: number,
  gap: number,
): { below: boolean; room: number } {
  const roomBelow = bounds.bottom - popupMargin - (box.bottom + gap);
  const roomAbove = box.top - gap - (bounds.top + popupMargin);
  const below =
    roomBelow >= need || (roomAbove < need && roomBelow >= roomAbove);
  return { below, room: Math.max(0, below ? roomBelow : roomAbove) };
}

function clampInto(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(value, high));
}

export interface PopupPlacement {
  /** The box the popup hangs from. */
  box: PopupBox;
  /** The popup's size as drawn. */
  size: { width: number; height: number };
  bounds: PopupBounds;
  /** `popupSide`'s side. */
  below: boolean;
  /** From the box to the popup, px, across and down. */
  gap: number;
}

/**
 * The popup's top-left corner: right of the box, else left of it, else (a box
 * wider than the room beside it) under its left end; below the box or above
 * it, by `below`; kept inside `bounds`.
 */
export function placePopup({
  box,
  size,
  bounds,
  below,
  gap,
}: PopupPlacement): { x: number; y: number } {
  const rightX = box.right + gap;
  const leftX = box.left - gap - size.width;
  let x = box.left;
  if (rightX + size.width <= bounds.width - popupMargin) x = rightX;
  else if (leftX >= popupMargin) x = leftX;
  const y = below ? box.bottom + gap : box.top - gap - size.height;
  return {
    x: clampInto(x, popupMargin, bounds.width - size.width - popupMargin),
    y: clampInto(
      y,
      bounds.top + popupMargin,
      bounds.bottom - size.height - popupMargin,
    ),
  };
}
