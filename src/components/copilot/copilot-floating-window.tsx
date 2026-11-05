"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CopilotFloatingRect } from "@/lib/ui-preferences/definitions";
import { useUiPreference } from "@/lib/ui-preferences/provider";
import {
  clampFloatingRect,
  resizeFloatingRect,
  type ResizeDirection,
  type Viewport,
} from "@/lib/copilot/floating-rect";
import { CopilotPanel } from "./copilot-panel";

/** Where each handle sits and the cursor it shows. */
const handles: { direction: ResizeDirection; className: string }[] = [
  { direction: "n", className: "inset-x-3 top-0 h-1.5 cursor-ns-resize" },
  { direction: "s", className: "inset-x-3 bottom-0 h-1.5 cursor-ns-resize" },
  { direction: "w", className: "inset-y-3 left-0 w-1.5 cursor-ew-resize" },
  { direction: "e", className: "inset-y-3 right-0 w-1.5 cursor-ew-resize" },
  { direction: "nw", className: "top-0 left-0 size-3 cursor-nwse-resize" },
  { direction: "se", className: "right-0 bottom-0 size-3 cursor-nwse-resize" },
  { direction: "ne", className: "top-0 right-0 size-3 cursor-nesw-resize" },
  { direction: "sw", className: "bottom-0 left-0 size-3 cursor-nesw-resize" },
];

function viewport(): Viewport {
  return { width: window.innerWidth, height: window.innerHeight };
}

type Gesture =
  | { kind: "move"; x: number; y: number; start: CopilotFloatingRect }
  | {
      kind: "resize";
      direction: ResizeDirection;
      x: number;
      y: number;
      start: CopilotFloatingRect;
    };

/**
 * A non-modal window over the page, so the page stays usable while chatting.
 * Drag it by its header; resize it from any edge or corner. Its position is
 * kept per device (anchored to the bottom-right corner). Escape closes it.
 */
export function CopilotFloatingWindow({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const [saved, setSaved] = useUiPreference("copilotFloatingRect");
  const [rect, setRect] = useState<CopilotFloatingRect>(saved);
  const gesture = useRef<Gesture | null>(null);
  // The latest rect of the gesture in progress, so end() saves it even when
  // pointerup arrives before the render that follows the last move.
  const gestureRect = useRef<CopilotFloatingRect | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);

  // Fit the saved rect to this viewport, and keep it fitting.
  useEffect(() => {
    const fit = () => {
      setRect((current) => clampFloatingRect(current, viewport()));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
    };
  }, []);

  // Focus moves into the window when it opens, as a dialog's would.
  useEffect(() => {
    windowRef.current?.querySelector<HTMLElement>("textarea")?.focus();
  }, []);

  /**
   * Whether an event happened inside the window's own DOM. React delivers
   * events from portals (the options menu) to their React parents too; a press
   * on a menu item must not start a drag, and Escape in a menu must not close
   * the window.
   */
  const isInside = (target: EventTarget) =>
    windowRef.current?.contains(target as Node) ?? false;

  const begin = (
    next: { kind: "move" } | { kind: "resize"; direction: ResizeDirection },
    event: React.PointerEvent<HTMLElement>,
  ) => {
    if (event.button !== 0 || !isInside(event.target)) return;
    // Buttons in the header keep their own clicks.
    if (
      next.kind === "move" &&
      (event.target as HTMLElement).closest("button, a, input, textarea")
    ) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      ...next,
      x: event.clientX,
      y: event.clientY,
      start: rect,
    };
    gestureRect.current = rect;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const current = gesture.current;
    if (!current) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    const next =
      current.kind === "move"
        ? clampFloatingRect(
            {
              ...current.start,
              right: current.start.right - dx,
              bottom: current.start.bottom - dy,
            },
            viewport(),
          )
        : resizeFloatingRect(current.start, current.direction, dx, dy, viewport());
    gestureRect.current = next;
    setRect(next);
  };

  const end = () => {
    const current = gesture.current;
    if (!current) return;
    const latest = gestureRect.current;
    gesture.current = null;
    gestureRect.current = null;
    // A press that never moved leaves the saved rect alone.
    if (latest && latest !== current.start) setSaved(latest);
  };

  return (
    <div
      ref={windowRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className="fixed right-(--copilot-right) bottom-(--copilot-bottom) z-50 flex h-(--copilot-height) w-(--copilot-width) flex-col overflow-hidden rounded-lg border bg-background shadow-2xl"
      style={
        {
          "--copilot-right": `${String(rect.right)}px`,
          "--copilot-bottom": `${String(rect.bottom)}px`,
          "--copilot-width": `${String(rect.width)}px`,
          "--copilot-height": `${String(rect.height)}px`,
        } as React.CSSProperties
      }
      onKeyDown={(event) => {
        if (
          event.key === "Escape" &&
          !event.defaultPrevented &&
          isInside(event.target)
        ) {
          onClose();
        }
      }}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {handles.map(({ direction, className }) => (
        <div
          key={direction}
          data-resize-handle={direction}
          aria-hidden
          className={`absolute z-10 touch-none ${className}`}
          onPointerDown={(event) => {
            begin({ kind: "resize", direction }, event);
          }}
        />
      ))}
      <CopilotPanel
        variant="floating"
        titleId={titleId}
        onClose={onClose}
        onHeaderPointerDown={(event) => {
          begin({ kind: "move" }, event);
        }}
      />
    </div>
  );
}
