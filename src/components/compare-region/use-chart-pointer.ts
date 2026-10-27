"use client";

/**
 * The Compare Region Viewer's pointer: the hover tooltip, click-to-pin and
 * the wheel guard. One set of handlers on the zoom's container serves every
 * glyph (event delegation): each glyph carries `data-row` and `data-feature`.
 */
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { isSameFeature, type FeatureRef } from "@/lib/compare-region/families";

/** A pointer that moved further than this between press and release dragged, not clicked. */
const clickSlop = 4;
/**
 * How long the hover outlasts the pointer on the empty track, ms: crossing
 * the gap to the next gene keeps the tooltip and the trace instead of
 * dropping them (and tracing the pinned family) for a moment.
 */
export const hoverGrace = 100;

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
 * Hover, click-to-pin and the wheel guard, for a chart whose root element
 * gets `wheelGuardRef` (position: relative; the tooltip and the card are
 * placed in it, beside their gene) and whose Zoom container svg gets
 * `handlers`.
 *
 * A plain wheel scrolls the page past the chart. ⌘ + wheel zooms 20% a notch,
 * through Zoom's `wheelDelta`; Ctrl + wheel and a trackpad pinch (which
 * browsers send as Ctrl + wheel) never reach `wheelDelta`: use-gesture hands
 * them to Zoom as a pinch, 10% an event. The guard stops
 * a plain wheel in the capture phase, before Zoom's non-passive listener,
 * which would cancel the scroll; it never cancels a wheel itself, so it is
 * passive. Same rule as `choropleth-svg.tsx`. Put `wheelGuardRef` on the
 * chart's root, outside `<Zoom>`, so the listener outlives anything Zoom
 * remounts. `onPick` hears every click that pins a gene (the chart opens its
 * card), not a drag's end or a click on the empty track. The hover lets go `hoverGrace` after the
 * pointer moves on to the empty track, at once when it leaves the figure or
 * presses.
 */
export function useChartPointer(onPick?: (ref: FeatureRef) => void) {
  const wheelGuardRef = useRef<HTMLDivElement>(null);
  const pressedAt = useRef<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selected, setSelected] = useState<FeatureRef | null>(null);
  const [hovered, setHovered] = useState<FeatureRef | undefined>(undefined);
  const hideTooltip = () => {
    setHovered(undefined);
  };

  const keepHover = () => {
    if (hideTimer.current === null) return;
    clearTimeout(hideTimer.current);
    hideTimer.current = null;
  };
  const hideNow = () => {
    keepHover();
    hideTooltip();
  };
  const hideSoon = () => {
    if (hideTimer.current !== null || !hovered) return;
    hideTimer.current = setTimeout(() => {
      hideTimer.current = null;
      hideTooltip();
    }, hoverGrace);
  };

  useEffect(
    () => () => {
      if (hideTimer.current !== null) clearTimeout(hideTimer.current);
    },
    [],
  );

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
      // `buttons`: no tooltip while a drag is panning.
      if (event.buttons !== 0) {
        hideNow();
        return;
      }
      if (!ref) {
        hideSoon();
        return;
      }
      keepHover();
      // Its label and outline are the same gene: keep the tooltip as it is.
      setHovered((previous) => (isSameFeature(previous, ref) ? previous : ref));
    },
    onPointerLeave: () => {
      hideNow();
    },
    onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => {
      pressedAt.current = event.clientX;
      // A drag pans the glyphs away from an open tooltip.
      hideNow();
    },
    // A click on a glyph pins it; on the empty track, it clears the pin.
    onClick: (event: ReactMouseEvent<SVGSVGElement>) => {
      const pressed = pressedAt.current;
      pressedAt.current = null;
      if (pressed !== null && Math.abs(event.clientX - pressed) > clickSlop) {
        return;
      }
      const ref = featureAt(event.target);
      setSelected(ref);
      if (ref) onPick?.(ref);
    },
  };

  return {
    wheelGuardRef,
    selected,
    setSelected,
    /** The hovered glyph, or undefined when the tooltip is closed. */
    hovered,
    handlers,
  };
}
