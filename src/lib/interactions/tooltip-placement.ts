export interface TooltipPlacement {
  left: number;
  top: number;
  /** The widest the tooltip may be, in px: its usual cap, or less where the box has less room. */
  maxWidth: number;
  /** Set only on a flipped axis; absent when the tooltip sits at the pointer's lower right. */
  transform?: string;
}

/** Distance between the pointer and the tooltip's nearest corner. */
export const tooltipGap = 12;

// The tooltip's size is not known before it renders, so the fit test uses the most it can take:
// 20rem wide (at the default font size) and about six `text-xs` lines tall.
const tooltipWidthBudget = 320;
const tooltipHeightBudget = 120;
// Narrower than this, a protein id and a locus tag no longer fit on a line.
const tooltipMinWidth = 120;

/**
 * Where to draw a hover tooltip, in the canvas box's own coordinates. It sits at the pointer's
 * lower right unless that would run past the box (which clips it) and there is more room on the
 * other side of the pointer, in which case it opens up or to the left instead. A CSS translate
 * flips it, so no measurement of the tooltip is needed. Its width is capped to the room on its
 * side of the pointer, so a box narrower than the tooltip wraps the text instead of clipping it.
 */
export function placeTooltip(
  pointer: { x: number; y: number },
  box: { width: number; height: number },
): TooltipPlacement {
  const flipX =
    pointer.x + tooltipGap + tooltipWidthBudget > box.width &&
    pointer.x > box.width / 2;
  const flipY =
    pointer.y + tooltipGap + tooltipHeightBudget > box.height &&
    pointer.y > box.height / 2;
  const room = flipX
    ? pointer.x - tooltipGap
    : box.width - pointer.x - tooltipGap;
  return {
    left: flipX ? pointer.x - tooltipGap : pointer.x + tooltipGap,
    top: flipY ? pointer.y - tooltipGap : pointer.y + tooltipGap,
    maxWidth: Math.min(tooltipWidthBudget, Math.max(room, tooltipMinWidth)),
    ...(flipX || flipY
      ? {
          transform: `translate(${flipX ? "-100%" : "0"}, ${flipY ? "-100%" : "0"})`,
        }
      : {}),
  };
}
