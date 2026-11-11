"use client";

import { useLayoutEffect, useRef } from "react";
import type { FigureHit } from "@/lib/circular-viewer/drawing";
import { itemTitle } from "@/lib/circular-viewer/item-fields";
import { placePopup, popupMaxWidth, popupSide } from "@/lib/popup-placement";
import { ItemFieldList } from "./circular-viewer-item-fields";

const pointerGap = 12;
const tooltipWidth = "20rem";

/**
 * A layout effect writes the place as custom properties before paint, so the
 * tooltip never shows in the wrong place. It depends on `hit.path` and
 * `hit.item`, not `hit`, which is a new object whenever the figure re-derives
 * it.
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
