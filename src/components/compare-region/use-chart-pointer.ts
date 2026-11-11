"use client";

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

const clickSlop = 4;
/**
 * Crossing the gap to the next gene keeps the tooltip and trace instead of
 * dropping them for a moment.
 */
export const hoverGrace = 100;

export function glyphSelector(at: FeatureRef): string {
  return `[data-row="${String(at.rowIndex)}"][data-feature="${String(at.featureIndex)}"]`;
}

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
 * A plain wheel scrolls the page past the chart; the guard stops it in the capture phase, before Zoom's non-passive listener would cancel the scroll.
 * Put `wheelGuardRef` on the chart's root, outside `<Zoom>`, so the listener outlives anything Zoom remounts.
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
  const [cursor, setCursor] = useState<FeatureRef | null>(null);
  const [focused, setFocused] = useState<FeatureRef | undefined>(undefined);
  const pressedLast = useRef(false);
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

  // On the document, so a focus can tell a press from a key wherever either happened.
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

  // A click focuses its gene, but a press on the card's text, or a pan that
  // culls the gene, leaves focus on the body, which no gene handler hears.
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
    onPointerOver: (event: ReactPointerEvent<SVGSVGElement>) => {
      const ref = featureAt(event.target);
      if (event.buttons !== 0) {
        hideNow();
        return;
      }
      if (!ref) {
        hideSoon();
        return;
      }
      keepHover();
      setHovered((previous) => (isSameFeature(previous, ref) ? previous : ref));
    },
    onPointerLeave: () => {
      hideNow();
    },
    onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => {
      pressedAt.current = event.clientX;
      const ref = featureAt(event.target);
      setPressed((previous) => (isSameFeature(previous, ref) ? previous : ref));
      hideNow();
      setFocused(undefined);
    },
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
      if (!featureAt(event.relatedTarget)) setFocused(undefined);
    },
    onKeyDown: (event: ReactKeyboardEvent<SVGSVGElement>) => {
      const ref = featureAt(event.target);
      if (!ref || event.altKey || event.ctrlKey || event.metaKey) return;
      const step = featureStepKeys[event.key];
      if (step) {
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
    hovered: hovered ?? focused,
    focused,
    tabStop,
    pressed,
    handlers,
  };
}
