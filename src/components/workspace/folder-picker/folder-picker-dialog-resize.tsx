"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import {
  resizeDialogSize,
  type DialogSize,
  type Viewport,
} from "./folder-picker-layout";

interface DialogCornerGripProps {
  size: DialogSize;
  viewport: Viewport;
  onResize: (size: DialogSize) => void;
  className?: string;
}

/**
 * Pointer-only bottom-right grip that resizes both axes. Keyboard and
 * single-pointer users resize through the width separator and the header's
 * Expand button, so this is hidden from assistive technology.
 */
export function DialogCornerGrip({
  size,
  viewport,
  onResize,
  className,
}: DialogCornerGripProps) {
  const dragRef = useRef<{ x: number; y: number; start: DialogSize } | null>(
    null,
  );
  return (
    <div
      aria-hidden
      data-slot="picker-resize-grip"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { x: event.clientX, y: event.clientY, start: size };
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag) return;
        onResize(
          resizeDialogSize(
            drag.start,
            event.clientX - drag.x,
            event.clientY - drag.y,
            viewport,
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
        "group absolute right-0 bottom-0 z-10 hidden size-4 cursor-nwse-resize touch-none md:block",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute right-1 bottom-1 size-2 border-r-2 border-b-2 border-border transition-colors group-hover:border-info group-active:border-info"
      />
    </div>
  );
}
