"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import {
  rememberUntouchedAxes,
  resizedAxes,
  resizeDialogByEdge,
  type DialogSize,
  type ResizeEdge,
  type Viewport,
} from "./folder-picker-layout";

/**
 * The sides and corners that resize by pointer alone. The east side is left out: it is
 * the width separator (`PaneResizeHandle`), which the keyboard can reach too.
 */
export type PointerResizeDirection = Exclude<ResizeEdge, "e">;

/**
 * Where each handle sits and what the pointer shows over it. An edge is an 8px strip along
 * the whole side; a corner is a 16px square. The corners stack above the edges (`z-20`
 * over `z-10`) so a press at a corner never falls through to an edge, and above the
 * width separator, whose ends they cover. The header's Close button and the footer's
 * buttons begin 16px in from the popup's edge (its `p-4`), so no handle reaches them.
 * Each string is spelled out in full so the design-system lint can read it.
 */
const handleClasses: Record<PointerResizeDirection, string> = {
  w: "inset-y-0 left-0 z-10 w-2 cursor-ew-resize",
  n: "inset-x-0 top-0 z-10 h-2 cursor-ns-resize",
  s: "inset-x-0 bottom-0 z-10 h-2 cursor-ns-resize",
  nw: "top-0 left-0 z-20 size-4 cursor-nwse-resize",
  ne: "top-0 right-0 z-20 size-4 cursor-nesw-resize",
  sw: "bottom-0 left-0 z-20 size-4 cursor-nesw-resize",
  se: "right-0 bottom-0 z-20 size-4 cursor-nwse-resize",
};

const pointerResizeDirections = Object.keys(
  handleClasses,
) as PointerResizeDirection[];

interface DialogResizeHandlesProps {
  size: DialogSize;
  /** What is stored for each axis (the default when none), which a small window may clamp in `size`. */
  remembered: DialogSize;
  viewport: Viewport;
  onResize: (size: DialogSize) => void;
}

interface DialogResizeHandleProps extends DialogResizeHandlesProps {
  direction: PointerResizeDirection;
}

/**
 * Pointer-only handles on every side and corner of the dialog but the east side, which is
 * the width separator. Keyboard and single-pointer users resize through that separator
 * and the header's Expand button, so these are hidden from assistive technology.
 */
export function DialogResizeHandles(props: DialogResizeHandlesProps) {
  return (
    <>
      {pointerResizeDirections.map((direction) => (
        <DialogResizeHandle key={direction} direction={direction} {...props} />
      ))}
    </>
  );
}

function DialogResizeHandle({
  direction,
  size,
  remembered,
  viewport,
  onResize,
}: DialogResizeHandleProps) {
  const dragRef = useRef<{
    x: number;
    y: number;
    start: DialogSize;
    remembered: DialogSize;
  } | null>(null);
  return (
    <div
      aria-hidden
      data-slot="picker-resize-grip"
      data-direction={direction}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
          x: event.clientX,
          y: event.clientY,
          start: size,
          remembered,
        };
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag) return;
        // Against where the drag began, so an axis dragged away and back returns to its
        // remembered value rather than the one the window clamps it to; an axis this
        // handle does not touch is left as it began, so it keeps its remembered value.
        onResize(
          rememberUntouchedAxes(
            resizeDialogByEdge(
              direction,
              drag.start,
              event.clientX - drag.x,
              event.clientY - drag.y,
              viewport,
            ),
            drag.start,
            drag.remembered,
            resizedAxes(direction),
          ),
        );
      }}
      onPointerUp={(event) => {
        dragRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      className={cn(
        "absolute hidden touch-none md:block",
        handleClasses[direction],
      )}
    />
  );
}
