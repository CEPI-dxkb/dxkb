/** Places a popup beside its box: below-right, else left or above where there is no room. */

export interface PopupBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const popupMargin = 8;

/** The widest a popup may be: the bounds less its margins, so wide cards fit a narrow phone figure. */
export function popupMaxWidth(width: number): number {
  return Math.max(0, width - 2 * popupMargin);
}

export interface PopupBounds {
  width: number;
  top: number;
  bottom: number;
}

/** Which side opens: below while it fits, above while it fits, else the roomier side. */
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
  box: PopupBox;
  size: { width: number; height: number };
  bounds: PopupBounds;
  below: boolean;
  gap: number;
}

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
