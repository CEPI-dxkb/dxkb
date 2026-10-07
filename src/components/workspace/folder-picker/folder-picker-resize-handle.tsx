"use client";

/**
 * A drag handle on a folder-picker pane's edge. Drag, or focus it and
 * press ← / →, to resize; double-click resets. It sits over the pane's border,
 * so the line it draws on hover is the border itself lighting up.
 */

import { useRef } from "react";
import { cn } from "@/lib/utils";

interface ResizeHandleProps {
  /** Which edge of the pane the handle sits on. */
  edge: "start" | "end";
  label: string;
  width: number;
  limits: { min: number; max: number; initial: number };
  onResize: (width: number) => void;
  className?: string;
}

const keyboardStep = 16;

export function PaneResizeHandle({
  edge,
  label,
  width,
  limits,
  onResize,
  className,
}: ResizeHandleProps) {
  const dragRef = useRef<{ x: number; width: number } | null>(null);
  // Dragging the divider right widens a pane whose handle is on its end edge
  // and narrows one whose handle is on its start edge.
  const sign = edge === "end" ? 1 : -1;
  const resize = (next: number) => {
    onResize(Math.round(Math.min(limits.max, Math.max(limits.min, next))));
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={limits.min}
      aria-valuemax={limits.max}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { x: event.clientX, width };
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (drag) resize(drag.width + sign * (event.clientX - drag.x));
      }}
      onPointerUp={(event) => {
        dragRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      onDoubleClick={() => {
        resize(limits.initial);
      }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        event.stopPropagation();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        resize(width + sign * direction * keyboardStep);
      }}
      className={cn(
        "group absolute inset-y-0 z-10 w-2 cursor-col-resize touch-none outline-none",
        edge === "end" ? "-right-1" : "-left-1",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors group-hover:bg-primary/50 group-focus-visible:bg-primary group-active:bg-primary"
      />
    </div>
  );
}
