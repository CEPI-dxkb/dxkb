"use client";

import { useLayoutEffect, useRef } from "react";
import type { FigureHit } from "@/lib/circular-viewer/drawing";
import { placePopup, popupMaxWidth, popupSide } from "@/lib/popup-placement";
import { ItemFieldList, itemTitle } from "./circular-viewer-item-fields";

/** From the pointer to the tooltip, px, across and down. */
const pointerGap = 12;
/** The tooltip's widest, as before; a narrower figure caps it further. */
const tooltipWidth = "20rem";

/**
 * Legacy's hover popup (`TooltipDialog` at the pointer, `formatPopupContent`),
 * placed beside the pointer by the placement Compare Region's popups share
 * (`@/lib/popup-placement`): below and right of it, left where the right lacks
 * room, above where below does, and kept inside the figure. A layout effect
 * measures the box (its width capped to 20rem and to the figure's less the margins first,
 * since a long value sets its narrowest width) and writes its place as custom
 * properties before the browser paints, so it never shows in the wrong place
 * and a move re-renders nothing more. It runs on the pointer's place and the
 * figure's size, not on `hit`, which is a new object whenever the figure
 * re-derives it; `hit.path`, a string compared by value, and `hit.item`, a
 * stable object from the cached drawing that changes exactly when the content
 * can, place it again when the mark under a still pointer changes (`path`
 * alone would miss two marks that share one).
 * `left`/`top` are the pointer's place in the figure's `width` × `height` box.
 */
export function CircularViewerTooltip({
  hit,
  left,
  top,
  width,
  height,
}: {
  hit: FigureHit;
  left: number;
  top: number;
  width: number;
  height: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const tip = ref.current;
    if (!tip) return;
    // The width first: it sets the height, which is measured below.
    tip.style.setProperty(
      "--tip-max-w",
      `min(${tooltipWidth}, ${String(popupMaxWidth(width))}px)`,
    );
    const size = { width: tip.offsetWidth, height: tip.offsetHeight };
    const pointer = { left, top, right: left, bottom: top };
    const bounds = { width, top: 0, bottom: height };
    const { below } = popupSide(pointer, bounds, size.height, pointerGap);
    const { x, y } = placePopup({
      box: pointer,
      size,
      bounds,
      below,
      gap: pointerGap,
    });
    tip.style.setProperty("--tip-x", `${String(x)}px`);
    tip.style.setProperty("--tip-y", `${String(y)}px`);
  }, [left, top, width, height, hit.path, hit.item]);
  return (
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none absolute top-0 left-0 z-10 max-w-(--tip-max-w) translate-x-(--tip-x) translate-y-(--tip-y) rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-lg"
    >
      <p className="mb-1 font-medium">{itemTitle(hit.item)}</p>
      <ItemFieldList item={hit.item} full={false} />
    </div>
  );
}
