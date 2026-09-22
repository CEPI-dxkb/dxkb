"use client";

import {
  type ReactNode,
  type RefObject,
  useEffectEvent,
  useLayoutEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";

interface AnchoredSuggestionPortalProps {
  anchorRef: RefObject<HTMLElement | null>;
  dropdownRef: RefObject<HTMLDivElement | null>;
  open: boolean;
  children: ReactNode;
}

interface DropdownRect {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

export function AnchoredSuggestionPortal({
  anchorRef,
  dropdownRef,
  open,
  children,
}: AnchoredSuggestionPortalProps) {
  const [rect, setRect] = useState<DropdownRect | null>(null);
  const updateLayout = useEffectEvent(() => {
    if (!open || !anchorRef.current) return;

    const anchorRect = anchorRef.current.getBoundingClientRect();
    const preferredHeight = 256;
    const minHeight = 160;
    const gap = 4;

    // The gap is part of the space the dropdown consumes, so subtract it once
    // and let both the threshold checks and the resulting heights use that
    // same budget. Adding the gap to `top` while sizing against the un-gapped
    // space overflows the viewport by up to `gap` pixels.
    const availableBelow = window.innerHeight - anchorRect.bottom - gap;

    if (availableBelow >= minHeight) {
      setRect({
        top: anchorRect.bottom + gap,
        left: anchorRect.left,
        width: anchorRect.width,
        maxHeight: Math.min(preferredHeight, availableBelow),
      });
      return;
    }

    // Flip up. Clamp to the space actually above the anchor so `top` can never
    // go negative and push the dropdown off the top of the viewport.
    const availableAbove = anchorRect.top - gap;
    const maxHeight = Math.min(preferredHeight, Math.max(availableAbove, 0));
    setRect({
      top: anchorRect.top - maxHeight - gap,
      left: anchorRect.left,
      width: anchorRect.width,
      maxHeight,
    });
  });

  // Layout effect, not a passive effect: `rect` is intentionally retained
  // while closed, so measuring after paint would render one frame at the
  // previous (possibly scrolled-away) position on reopen.
  useLayoutEffect(() => {
    if (!open) return;
    updateLayout();
    window.addEventListener("scroll", updateLayout, true);
    window.addEventListener("resize", updateLayout);
    return () => {
      window.removeEventListener("scroll", updateLayout, true);
      window.removeEventListener("resize", updateLayout);
    };
  }, [open]);

  if (!open || !rect || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={dropdownRef}
      className="scrollbar-thumb-muted-foreground/20 bg-popover hover:scrollbar-thumb-muted-foreground/40 fixed z-40 scrollbar-thin scrollbar-track-transparent overflow-y-auto rounded-md border shadow-md"
      style={rect}
    >
      {children}
    </div>,
    document.body,
  );
}
