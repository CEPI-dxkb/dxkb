/**
 * Written to the element (custom properties and `data-offscreen`), not through
 * React, so following the gene re-renders nothing.
 */
import { rulerHeight } from "@/lib/compare-region/density";
import type { FeatureRef } from "@/lib/compare-region/families";
import {
  featureCardMinRoom,
  featurePopupGap,
  glyphInView,
} from "@/lib/compare-region/feature-popup";
import {
  placePopup,
  popupMaxWidth,
  popupSide,
} from "@/lib/popup-placement";

interface PlaceFeaturePopupOptions {
  popup: HTMLElement | null;
  root: HTMLElement | null;
  scroller: HTMLElement | null;
  at: FeatureRef | null | undefined;
  labelWidth: number;
}

/** Measured past any height limit already set, so placing it again decides the same. */
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
  // The width first: it sets the popup's height.
  popup.style.setProperty(
    "--popup-max-w",
    `${String(popupMaxWidth(rootBox.width))}px`,
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
  const bounds = { width: rootBox.width, top, bottom: rootBox.height };
  const { below, room } = popupSide(
    glyph,
    bounds,
    neededHeight(popup),
    featurePopupGap,
  );
  popup.style.setProperty("--popup-max-h", `${String(room)}px`);
  const { x, y } = placePopup({
    box: glyph,
    size: { width: popup.offsetWidth, height: popup.offsetHeight },
    bounds,
    below,
    gap: featurePopupGap,
  });
  popup.style.setProperty("--popup-x", `${String(x)}px`);
  popup.style.setProperty("--popup-y", `${String(y)}px`);
  popup.removeAttribute("data-offscreen");
}
