"use client";

/**
 * The Compare Region Viewer's pointer: the hover tooltip, click-to-pin and
 * the wheel guard. One set of handlers on the zoom's container serves every
 * glyph (event delegation): each glyph carries `data-row` and `data-feature`.
 */
import { useTooltip } from "@visx/tooltip";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { FeatureRef } from "@/lib/compare-region/families";

/** A pointer that moved further than this between press and release dragged, not clicked. */
const clickSlop = 4;
/** From the pointer to the tooltip's corner, px. */
const tooltipOffset = 12;

/** The feature a pointer event landed on, from the glyph's data attributes. */
function featureAt(target: EventTarget): FeatureRef | null {
  if (!(target instanceof Element)) return null;
  const glyph = target.closest("[data-feature]");
  if (!glyph) return null;
  return {
    rowIndex: Number(glyph.getAttribute("data-row")),
    featureIndex: Number(glyph.getAttribute("data-feature")),
  };
}

/**
 * Hover tooltip, click-to-pin and the wheel guard, for a chart whose root
 * element gets `wheelGuardRef` (position: relative; the tooltip is placed in
 * it) and whose Zoom container svg gets `handlers`.
 *
 * A plain wheel scrolls the page past the chart. ⌘ + wheel zooms 20% a notch,
 * through Zoom's `wheelDelta`; Ctrl + wheel and a trackpad pinch (which
 * browsers send as Ctrl + wheel) never reach `wheelDelta`: use-gesture hands
 * them to Zoom as a pinch, 10% an event. The guard stops
 * a plain wheel in the capture phase, before Zoom's non-passive listener,
 * which would cancel the scroll; it never cancels a wheel itself, so it is
 * passive. Same rule as `choropleth-svg.tsx`. Put `wheelGuardRef` on the
 * chart's root, outside `<Zoom>`, so the listener outlives anything Zoom
 * remounts.
 */
export function useChartPointer() {
  const wheelGuardRef = useRef<HTMLDivElement>(null);
  const pressedAt = useRef<number | null>(null);
  const [selected, setSelected] = useState<FeatureRef | null>(null);
  const tooltip = useTooltip<FeatureRef>();
  const { showTooltip, hideTooltip } = tooltip;

  useEffect(() => {
    const node = wheelGuardRef.current;
    if (!node) return;
    const passPlainWheelToPage = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) event.stopPropagation();
    };
    node.addEventListener("wheel", passPlainWheelToPage, {
      capture: true,
      passive: true,
    });
    return () => {
      node.removeEventListener("wheel", passPlainWheelToPage, {
        capture: true,
      });
    };
  }, []);

  const handlers = {
    // On entering a glyph, not on every move.
    onPointerOver: (event: ReactPointerEvent<SVGSVGElement>) => {
      const ref = featureAt(event.target);
      const box = wheelGuardRef.current?.getBoundingClientRect();
      // `buttons`: no tooltip while a drag is panning.
      if (!ref || !box || event.buttons !== 0) {
        hideTooltip();
        return;
      }
      showTooltip({
        tooltipData: ref,
        tooltipLeft: event.clientX - box.left + tooltipOffset,
        tooltipTop: event.clientY - box.top + tooltipOffset,
      });
    },
    onPointerLeave: () => {
      hideTooltip();
    },
    onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => {
      pressedAt.current = event.clientX;
      // A drag pans the glyphs away from an open tooltip.
      hideTooltip();
    },
    // A click on a glyph pins it; on the empty track, it clears the pin.
    onClick: (event: ReactMouseEvent<SVGSVGElement>) => {
      const pressed = pressedAt.current;
      pressedAt.current = null;
      if (pressed !== null && Math.abs(event.clientX - pressed) > clickSlop) {
        return;
      }
      setSelected(featureAt(event.target));
    },
  };

  return {
    wheelGuardRef,
    selected,
    setSelected,
    /** The hovered glyph, or undefined when the tooltip is closed. */
    hovered: tooltip.tooltipOpen ? tooltip.tooltipData : undefined,
    tooltipLeft: tooltip.tooltipLeft,
    tooltipTop: tooltip.tooltipTop,
    handlers,
  };
}
