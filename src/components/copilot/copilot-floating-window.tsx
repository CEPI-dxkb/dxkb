"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type {
  CopilotFloatingRect,
  CopilotTabPlacement,
} from "@/lib/ui-preferences/definitions";
import { useUiPreference } from "@/lib/ui-preferences/provider";
import {
  clampFloatingRect,
  resizeFloatingRect,
  type ResizeDirection,
  type Viewport,
} from "@/lib/copilot/floating-rect";
import { playTuck } from "@/lib/copilot/tuck";
import { cn } from "@/lib/utils";
import { CopilotPanel } from "./copilot-panel";

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

// The physical edge a handle sits on becomes the opposite one when the window hangs off the left.
const mirroredDirection = (direction: ResizeDirection): ResizeDirection =>
  direction.replace(/[ew]/, (edge) => (edge === "e" ? "w" : "e")) as ResizeDirection;

/**
 * The draggable, resizable chat window. It hangs off the edge tab's side (`edge`): on the left the
 * saved `right` offset is measured from the left edge instead. Minimized, it stays mounted but
 * hidden and inert, so the chat, its scroll position and the window's place survive, and it tucks
 * into the tab and grows back out of it.
 */
export function CopilotFloatingWindow({
  edge,
  minimized,
  onMinimize,
  onClose,
}: {
  edge: CopilotTabPlacement;
  minimized: boolean;
  onMinimize: () => void;
  onClose: () => void;
}) {
  const mirrored = edge.side === "left";
  const titleId = useId();
  const [saved, setSaved] = useUiPreference("copilotFloatingRect");
  const [rect, setRect] = useState<CopilotFloatingRect>(saved);
  const gesture = useRef<Gesture | null>(null);
  // Latest gesture rect, so end() saves it even when pointerup arrives before the next render.
  const gestureRect = useRef<CopilotFloatingRect | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    windowRef.current?.querySelector<HTMLElement>("textarea")?.focus();
  }, []);

  // Minimize and restore tuck the window into, and out of, the edge tab.
  const wasMinimized = useRef(minimized);
  const tuck = useRef<Animation | null>(null);
  useLayoutEffect(() => {
    if (wasMinimized.current === minimized) return;
    wasMinimized.current = minimized;
    const element = windowRef.current;
    if (!element) return;
    tuck.current?.cancel();
    const bounds = element.getBoundingClientRect();
    tuck.current = playTuck(
      element,
      {
        x: (edge.side === "right" ? window.innerWidth - 16 : 16) - bounds.left,
        y: edge.top * window.innerHeight - bounds.top,
      },
      minimized ? "minimize" : "restore",
    );
  }, [minimized, edge]);

  // React delivers portal events (the layout, model and mode menus) to React parents too, so check the real DOM.
  const isInside = (target: EventTarget) =>
    windowRef.current?.contains(target as Node) ?? false;

  const begin = (
    next: { kind: "move" } | { kind: "resize"; direction: ResizeDirection },
    event: React.PointerEvent<HTMLElement>,
  ) => {
    if (event.button !== 0 || !isInside(event.target)) return;
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
              right: current.start.right - (mirrored ? -dx : dx),
              bottom: current.start.bottom - dy,
            },
            viewport(),
          )
        : resizeFloatingRect(
            current.start,
            mirrored ? mirroredDirection(current.direction) : current.direction,
            mirrored ? -dx : dx,
            dy,
            viewport(),
          );
    gestureRect.current = next;
    setRect(next);
  };

  const end = () => {
    const current = gesture.current;
    if (!current) return;
    const latest = gestureRect.current;
    gesture.current = null;
    gestureRect.current = null;
    if (latest && latest !== current.start) setSaved(latest);
  };

  return (
    <div
      ref={windowRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      inert={minimized}
      className={cn(
        "fixed bottom-(--copilot-bottom) z-50 flex h-(--copilot-height) w-(--copilot-width) flex-col overflow-hidden rounded-lg border bg-background shadow-2xl",
        mirrored ? "left-(--copilot-right)" : "right-(--copilot-right)",
        minimized && "pointer-events-none invisible",
      )}
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
        onMinimize={onMinimize}
        onHeaderPointerDown={(event) => {
          begin({ kind: "move" }, event);
        }}
      />
    </div>
  );
}
