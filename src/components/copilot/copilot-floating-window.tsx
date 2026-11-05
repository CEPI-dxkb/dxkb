"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CopilotFloatingRect } from "@/lib/ui-preferences/definitions";
import { useUiPreference } from "@/lib/ui-preferences/provider";
import { CopilotPanel } from "./copilot-panel";

const margin = 8;
const minWidth = 320;
const minHeight = 360;

interface Viewport {
  width: number;
  height: number;
}

/** Keeps the window on screen, shrinking it before moving it. */
export function clampFloatingRect(
  rect: CopilotFloatingRect,
  viewport: Viewport,
): CopilotFloatingRect {
  const width = Math.max(
    Math.min(minWidth, viewport.width - 2 * margin),
    Math.min(rect.width, viewport.width - 2 * margin),
  );
  const height = Math.max(
    Math.min(minHeight, viewport.height - 2 * margin),
    Math.min(rect.height, viewport.height - 2 * margin),
  );
  return {
    width,
    height,
    right: Math.min(Math.max(rect.right, margin), viewport.width - width - margin),
    bottom: Math.min(Math.max(rect.bottom, margin), viewport.height - height - margin),
  };
}

/** A resize handle: the edges (n, e, s, w) or corner it moves. */
export type ResizeDirection = "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";

/**
 * The rect after dragging the `direction` edges by (dx, dy). Only the dragged
 * edges move: a window at its minimum size stops shrinking rather than
 * sliding, and an edge stops at the viewport margin.
 */
export function resizeFloatingRect(
  start: CopilotFloatingRect,
  direction: ResizeDirection,
  dx: number,
  dy: number,
  viewport: Viewport,
): CopilotFloatingRect {
  // Edges as distances from the viewport's top-left corner.
  let left = viewport.width - start.right - start.width;
  let right = viewport.width - start.right;
  let top = viewport.height - start.bottom - start.height;
  let bottom = viewport.height - start.bottom;

  if (direction.includes("w")) {
    left = Math.min(Math.max(left + dx, margin), right - minWidth);
  }
  if (direction.includes("e")) {
    right = Math.max(Math.min(right + dx, viewport.width - margin), left + minWidth);
  }
  if (direction.includes("n")) {
    top = Math.min(Math.max(top + dy, margin), bottom - minHeight);
  }
  if (direction.includes("s")) {
    bottom = Math.max(Math.min(bottom + dy, viewport.height - margin), top + minHeight);
  }

  return {
    width: right - left,
    height: bottom - top,
    right: viewport.width - right,
    bottom: viewport.height - bottom,
  };
}

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
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const current = gesture.current;
    if (!current) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    setRect(
      current.kind === "move"
        ? clampFloatingRect(
            {
              ...current.start,
              right: current.start.right - dx,
              bottom: current.start.bottom - dy,
            },
            viewport(),
          )
        : resizeFloatingRect(current.start, current.direction, dx, dy, viewport()),
    );
  };

  const end = () => {
    if (!gesture.current) return;
    gesture.current = null;
    setSaved(rect);
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
