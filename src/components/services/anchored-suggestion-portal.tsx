"use client";

import {
  type ReactNode,
  type RefObject,
  useEffect,
  useEffectEvent,
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
    const spaceBelow = window.innerHeight - anchorRect.bottom;
    const preferredHeight = 256;
    const minHeight = 160;
    const gap = 4;

    if (spaceBelow >= preferredHeight) {
      setRect({
        top: anchorRect.bottom + gap,
        left: anchorRect.left,
        width: anchorRect.width,
        maxHeight: preferredHeight,
      });
      return;
    }

    if (spaceBelow >= minHeight) {
      setRect({
        top: anchorRect.bottom + gap,
        left: anchorRect.left,
        width: anchorRect.width,
        maxHeight: Math.max(spaceBelow - gap, minHeight),
      });
      return;
    }

    const maxHeight = Math.max(anchorRect.top - gap, minHeight);
    setRect({
      top: anchorRect.top - maxHeight - gap,
      left: anchorRect.left,
      width: anchorRect.width,
      maxHeight,
    });
  });

  useEffect(() => {
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
