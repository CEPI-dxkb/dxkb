"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Maximize2, Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ExpandableViewerWrapperProps {
  children: ReactNode;
  title?: string;
}

/**
 * Wraps a viewer component with an expand/collapse fullscreen toggle.
 *
 * Uses CSS-only expansion (`fixed inset-0`) instead of React portals so that
 * imperative children (e.g. Mol* WebGL canvas) are never unmounted — their DOM
 * node stays in place and is simply repositioned to cover the viewport.
 */
export function ExpandableViewerWrapper({
  children,
  title,
}: ExpandableViewerWrapperProps) {
  const [expanded, setExpanded] = useState(false);
  // Two-phase animation: `entering` starts opacity-0, next frame flips to
  // opacity-100 to trigger the CSS transition.
  const [entering, setEntering] = useState(false);
  const rafRef = useRef(0);

  const expand = useCallback(() => {
    setExpanded(true);
    setEntering(true);
    // Wait one frame so the browser paints with opacity-0, then transition in.
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        setEntering(false);
      });
    });
  }, []);

  const collapse = useCallback(() => setExpanded(false), []);

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        collapse();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [expanded, collapse]);

  return (
    <div
      className={
        expanded
          ? `bg-background fixed inset-0 z-50 flex flex-col transition-opacity duration-200 ease-out ${entering ? "opacity-0" : "opacity-100"}`
          : "relative h-full w-full"
      }
    >
      {expanded && (
        <div
          className={`border-border flex shrink-0 items-center gap-2 border-b px-3 py-2 transition-transform duration-200 ease-out ${entering ? "-translate-y-2" : "translate-y-0"}`}
        >
          {title && (
            <span className="truncate text-sm font-medium">{title}</span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={collapse}
              title="Collapse"
            >
              <Minimize2 />
            </Button>
          </div>
        </div>
      )}
      <div className={expanded ? "min-h-0 flex-1" : "h-full w-full"}>
        {children}
      </div>
      {!expanded && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-2 right-2 z-10 bg-background/80 backdrop-blur-sm"
          onClick={expand}
          title="Expand to full screen"
        >
          <Maximize2 />
        </Button>
      )}
    </div>
  );
}
