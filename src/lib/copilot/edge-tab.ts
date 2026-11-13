// The minimized chat's edge tab: a small button on the left or right window edge. It is dragged
// along the edge or across to the other one (it snaps to the nearer side), and arrow keys move it.
// Pure, so the tab component only wires pointer and key events to these.

import { copilotName } from "@/lib/copilot/name";
import type {
  CopilotTabPlacement,
  CopilotTabSide,
} from "@/lib/ui-preferences/definitions";

/** The tab's top stays between these fractions of the window height, clear of the bottom edge. */
export const tabTopMin = 0.08;
export const tabTopMax = 0.94;
/**
 * The tab is centred on its top, so it also never rises above this many px: the navbar (72px) plus
 * half the tab (32px) and a gap, so on a short window it still stays off the navbar's avatar.
 */
export const tabMinTopPx = 112;
/** How far ArrowUp / ArrowDown move the tab, as a fraction of the window height. */
export const tabKeyStep = 0.05;
/** A press that moves less than this (px) is a click, not a drag. */
export const tabDragThreshold = 5;
/** A drag ends with a click on the tab; one this soon (ms) after a drag is not a restore. */
export const tabClickGuardMs = 200;

interface Point {
  x: number;
  y: number;
}

/** Where the tab really sits: `top` held between the limits, and under the navbar's floor on a short window. */
export function clampTabTop(top: number, viewportHeight: number): number {
  const min = Math.max(tabTopMin, tabMinTopPx / viewportHeight);
  return Math.min(tabTopMax, Math.max(min, top));
}

export function isTabDrag(from: Point, to: Point): boolean {
  return Math.hypot(to.x - from.x, to.y - from.y) >= tabDragThreshold;
}

/** Where a tab dropped at `point` lands: the nearer side, at the pointer's height. */
export function tabPlacementAt(
  point: Point,
  viewport: { width: number; height: number },
): CopilotTabPlacement {
  const side: CopilotTabSide = point.x < viewport.width / 2 ? "left" : "right";
  return { side, top: clampTabTop(point.y / viewport.height, viewport.height) };
}

/**
 * Up and Down move the tab along its edge, Left and Right switch edges; null for any other key.
 * Each press starts from where the tab is drawn, so one never moves a tab that is held at the floor.
 */
export function tabPlacementForKey(
  placement: CopilotTabPlacement,
  key: string,
  viewportHeight: number,
): CopilotTabPlacement | null {
  const { side } = placement;
  const top = clampTabTop(placement.top, viewportHeight);
  if (key === "ArrowUp") {
    return { side, top: clampTabTop(top - tabKeyStep, viewportHeight) };
  }
  if (key === "ArrowDown") {
    return { side, top: clampTabTop(top + tabKeyStep, viewportHeight) };
  }
  if (key === "ArrowLeft") return { side: "left", top };
  if (key === "ArrowRight") return { side: "right", top };
  return null;
}

/** The start of an answer as one line of plain text, for the tab's tooltip. */
export function answerPreview(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/[*_`#>|[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

/** The tab's tooltip: what the minimized chat is doing, or the start of its newest answer. */
export function tabTitle({
  working,
  unread,
  preview,
}: {
  working: boolean;
  unread: boolean;
  preview: string;
}): string {
  const status = working
    ? `${copilotName} is writing an answer`
    : unread
      ? `${copilotName}: answer ready`
      : preview || `Restore ${copilotName}`;
  return `${status.replace(/[.…]+$/, "")}. Drag to move.`;
}
