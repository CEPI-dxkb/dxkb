/**
 * Places a gene's popup (the hover tooltip or the pinned card) beside its
 * glyph as it is drawn now, after a hover, a zoom, a pan, a scroll or a
 * density switch, or hides it while the gene is out of view. Written to the
 * element (custom properties `--popup-x`, `--popup-y`, `--popup-max-h` and
 * `--popup-max-w`, and `data-offscreen`), not through React, so following
 * the gene re-renders nothing. The rules are `feature-popup.ts`'s.
 */
import { rulerHeight } from "@/lib/compare-region/density";
import type { FeatureRef } from "@/lib/compare-region/families";
import {
  featureCardMinRoom,
  featurePopupMaxWidth,
  featurePopupSide,
  glyphInView,
  placeFeaturePopup,
} from "@/lib/compare-region/feature-popup";

interface PlaceFeaturePopupOptions {
  popup: HTMLElement | null;
  /** The chart's root (position: relative), which the popup is placed in. */
  root: HTMLElement | null;
  /** The figure's scroller, which holds the glyphs. */
  scroller: HTMLElement | null;
  /** The gene the popup is about. */
  at: FeatureRef | null | undefined;
  /** The sticky label column's width: the plot is in view right of it. */
  labelWidth: number;
}

/**
 * The height the popup needs on its side: all of it, or for one with a part
 * marked `data-popup-scroller` (the expanded card's details) a fair room,
 * which that part then scrolls in. Measured past any height limit already
 * set, so placing it again decides the same.
 */
function neededHeight(popup: HTMLElement): number {
  const scrolling = popup.querySelector<HTMLElement>("[data-popup-scroller]");
  if (!scrolling) return Math.max(popup.offsetHeight, popup.scrollHeight);
  const full =
    popup.offsetHeight - scrolling.clientHeight + scrolling.scrollHeight;
  return Math.min(full, featureCardMinRoom);
}

export function placeFeaturePopupElement({
  popup,
  root,
  scroller,
  at,
  labelWidth,
}: PlaceFeaturePopupOptions): void {
  if (!popup || !root || !scroller || !at) return;
  const element = scroller.querySelector(
    `[data-row="${String(at.rowIndex)}"][data-feature="${String(at.featureIndex)}"]`,
  );
  const rootBox = root.getBoundingClientRect();
  // The width first: it sets the popup's height, and its size is measured below.
  popup.style.setProperty(
    "--popup-max-w",
    `${String(featurePopupMaxWidth(rootBox.width))}px`,
  );
  const scrollerBox = scroller.getBoundingClientRect();
  const left = scrollerBox.left - rootBox.left;
  const top = scrollerBox.top - rootBox.top;
  const box = element?.getBoundingClientRect();
  const glyph =
    box &&
    glyphInView(
      {
        left: box.left - rootBox.left,
        top: box.top - rootBox.top,
        right: box.right - rootBox.left,
        bottom: box.bottom - rootBox.top,
      },
      {
        left: left + labelWidth,
        top: top + rulerHeight,
        right: left + scroller.clientWidth,
        bottom: top + scroller.clientHeight,
      },
    );
  if (!glyph) {
    popup.setAttribute("data-offscreen", "");
    return;
  }
  // From the figure's top down: the command bar and the strip stay in reach.
  const bounds = { width: rootBox.width, top, bottom: rootBox.height };
  // The height first: the room on its side limits the card's.
  const { below, room } = featurePopupSide(glyph, bounds, neededHeight(popup));
  popup.style.setProperty("--popup-max-h", `${String(room)}px`);
  const { x, y } = placeFeaturePopup({
    glyph,
    size: { width: popup.offsetWidth, height: popup.offsetHeight },
    bounds,
    below,
  });
  popup.style.setProperty("--popup-x", `${String(x)}px`);
  popup.style.setProperty("--popup-y", `${String(y)}px`);
  popup.removeAttribute("data-offscreen");
}
