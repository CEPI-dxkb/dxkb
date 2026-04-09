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
import { Separator } from "@/components/ui/separator";

interface ExpandableViewerWrapperProps {
  children: ReactNode;
  title?: string;
  /** Fires after expand/collapse so consumers can react (e.g. resize a canvas). */
  onExpandChange?: (expanded: boolean) => void;
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
  onExpandChange,
}: ExpandableViewerWrapperProps) {
  const [expanded, setExpanded] = useState(false);
  // Two-phase animation: `entering`/`leaving` start opacity-0, next frame
  // flips to opacity-100 (or vice-versa) to trigger the CSS transition.
  const [entering, setEntering] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const rafRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const expand = useCallback(() => {
    clearTimeout(timerRef.current);
    setLeaving(false);
    setExpanded(true);
    setEntering(true);
    // Wait one frame so the browser paints with opacity-0, then transition in.
    rafRef.current = requestAnimationFrame(() => {
      setEntering(false);
      onExpandChange?.(true);
    });
  }, [onExpandChange]);

  const collapse = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setEntering(false);
    setLeaving(true);
    // Fade out first, then switch to inline layout after the transition ends.
    timerRef.current = setTimeout(() => {
      setLeaving(false);
      setExpanded(false);
      rafRef.current = requestAnimationFrame(() => {
        onExpandChange?.(false);
      });
    }, 200);
  }, [onExpandChange]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timerRef.current);
    };
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
          ? `fixed inset-0 z-50 flex flex-col bg-background transition-opacity duration-200 ease-out ${entering || leaving ? "opacity-0" : "opacity-100"}`
          : "relative h-full w-full"
      }
    >
      {expanded && (
        <>
          <div
            className={`flex shrink-0 items-center gap-2 px-3 py-2 transition-transform duration-200 ease-out ${entering || leaving ? "-translate-y-2" : "translate-y-0"}`}
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
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Separator />
        </>
      )}
      <div className={expanded ? "min-h-0 flex-1" : "h-full w-full"}>
        {children}
      </div>
      {!expanded && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-2 right-2 z-10 bg-background/70 backdrop-blur-sm hover:bg-background/90"
          onClick={expand}
          title="Expand to full screen"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
