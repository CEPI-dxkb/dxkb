"use client";

/**
 * The Compare Region Viewer's pointer and keyboard: the hover tooltip,
 * click-to-pin, the wheel guard, and moving between genes and pinning one
 * from the keyboard. One set of handlers on the zoom's container serves every
 * glyph (event delegation): each glyph carries `data-row` and `data-feature`.
 */
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  isSameFeature,
  resolveFeature,
  type FeatureRef,
} from "@/lib/compare-region/families";
import {
  defaultTabStop,
  featureStepKeys,
  stepFeature,
} from "@/lib/compare-region/keyboard";
import type { CompareRegionLayout } from "@/lib/compare-region/layout";

/** A pointer that moved further than this between press and release dragged, not clicked. */
const clickSlop = 4;
/**
 * How long the hover outlasts the pointer on the empty track, ms: crossing
 * the gap to the next gene keeps the tooltip and the trace instead of
 * dropping them (and tracing the pinned family) for a moment.
 */
export const hoverGrace = 100;

/** The selector for `at`'s glyph, by its data attributes. */
export function glyphSelector(at: FeatureRef): string {
  return `[data-row="${String(at.rowIndex)}"][data-feature="${String(at.featureIndex)}"]`;
}

/** The feature an event landed on, from the glyph's data attributes. */
function featureAt(target: EventTarget | null): FeatureRef | null {
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
 *
 * The keyboard: the glyphs are buttons, and the figure is one tab stop
 * (`tabStop`, the one glyph with `tabIndex` 0: the gene last focused, else
 * the pinned one, else the focus gene). From a focused gene, ← and → move
 * along its row, Home and End to the row's ends, ↑ and ↓ to the nearest gene
 * in the next row with any; Enter or Space pins it (`onPick` hears that too)
 * and Escape clears the pin (also with focus on the body, as a press on the
 * card's text leaves it). A gene focused from the keyboard shows as a
 * hovered one does (tooltip, trace and ring), and `focused` names it so the
 * chart can bring it into view; one a press focused shows nothing more.
 */
export function useChartPointer(
  layout: CompareRegionLayout,
  onPick?: (ref: FeatureRef) => void,
) {
  const wheelGuardRef = useRef<HTMLDivElement>(null);
  const pressedAt = useRef<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selected, setSelected] = useState<FeatureRef | null>(null);
  const [hovered, setHovered] = useState<FeatureRef | undefined>(undefined);
  const [pressed, setPressed] = useState<FeatureRef | null>(null);
  /** The gene last focused, which keeps the tab stop. */
  const [cursor, setCursor] = useState<FeatureRef | null>(null);
  /** The gene keyboard focus is on; undefined while none is, or a press focused it. */
  const [focused, setFocused] = useState<FeatureRef | undefined>(undefined);
  /** Whether the last input was a press, not a key: a focus it gives a gene is not shown. */
  const pressedLast = useRef(false);
  /** A key moved the tab stop: its container, which focuses the new stop once it is drawn. */
  const pendingFocus = useRef<Element | null>(null);
  const tabStop = useMemo(
    () =>
      [cursor, selected].find((ref) => resolveFeature(layout, ref)) ??
      defaultTabStop(layout),
    [layout, cursor, selected],
  );
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

  // On the document, so a focus can tell a press from a key wherever either
  // happened (a press on the card's Close, which hands focus back to the gene).
  useEffect(() => {
    const press = () => {
      pressedLast.current = true;
    };
    const key = () => {
      pressedLast.current = false;
    };
    document.addEventListener("pointerdown", press, true);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", press, true);
      document.removeEventListener("keydown", key, true);
    };
  }, []);

  // Escape clears the pin from wherever focus is: a click focuses its gene
  // (whose keydown clears it), but a press on the card's text, or a pan that
  // culls the gene, leaves focus on the body, which no handler here hears.
  // Focus anywhere else (a menu, a field) keeps its own Escape.
  useEffect(() => {
    if (!selected) return;
    const clear = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const active = document.activeElement;
      if (active && active !== document.body) return;
      setSelected(null);
    };
    document.addEventListener("keydown", clear);
    return () => {
      document.removeEventListener("keydown", clear);
    };
  }, [selected]);

  // A key moved the tab stop: focus it, now that it is drawn (the tab stop
  // always is, however far off the plot).
  useLayoutEffect(() => {
    const container = pendingFocus.current;
    pendingFocus.current = null;
    if (!container || !cursor) return;
    container
      .querySelector<SVGElement>(glyphSelector(cursor))
      ?.focus({ preventScroll: true });
  }, [cursor]);

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
      const ref = featureAt(event.target);
      setPressed((previous) => (isSameFeature(previous, ref) ? previous : ref));
      // A drag pans the glyphs away from an open tooltip.
      hideNow();
      setFocused(undefined);
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
    onFocus: (event: ReactFocusEvent<SVGSVGElement>) => {
      const ref = featureAt(event.target);
      if (!ref) return;
      setCursor((previous) => (isSameFeature(previous, ref) ? previous : ref));
      setFocused(pressedLast.current ? undefined : ref);
    },
    onBlur: (event: ReactFocusEvent<SVGSVGElement>) => {
      // On to another gene: its focus takes over, with no blink between.
      if (!featureAt(event.relatedTarget)) setFocused(undefined);
    },
    onKeyDown: (event: ReactKeyboardEvent<SVGSVGElement>) => {
      const ref = featureAt(event.target);
      if (!ref || event.altKey || event.ctrlKey || event.metaKey) return;
      const step = featureStepKeys[event.key];
      if (step) {
        // Also at a row's end, so the scroller does not scroll instead.
        event.preventDefault();
        const next = stepFeature(layout, ref, step);
        if (!next) return;
        pendingFocus.current = event.currentTarget;
        setCursor(next);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setSelected(ref);
        onPick?.(ref);
      } else if (event.key === "Escape" && selected) {
        setSelected(null);
      }
    },
  };

  return {
    wheelGuardRef,
    selected,
    setSelected,
    /**
     * The hovered glyph (else the one keyboard focus is on), or undefined
     * when the tooltip is closed.
     */
    hovered: hovered ?? focused,
    /** The glyph keyboard focus is on, which the chart brings into view. */
    focused,
    /** The glyph with `tabIndex` 0 (null for a figure with no features): drawn however far off the plot. */
    tabStop,
    /**
     * The glyph the last press landed on (null on the empty track): a drag
     * from it must keep it drawn, since it holds the pointer's capture.
     */
    pressed,
    handlers,
  };
}
