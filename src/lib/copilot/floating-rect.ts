import type { CopilotFloatingRect } from "@/lib/ui-preferences/definitions";

export const margin = 8;
export const minWidth = 320;
export const minHeight = 360;

export interface Viewport {
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

  return clampFloatingRect(
    {
      width: right - left,
      height: bottom - top,
      right: viewport.width - right,
      bottom: viewport.height - bottom,
    },
    viewport,
  );
}
