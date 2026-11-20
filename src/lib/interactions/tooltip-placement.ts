export interface TooltipPlacement {
  left: number;
  top: number;
  /** Set only on a flipped axis; absent when the tooltip sits at the pointer's lower right. */
  transform?: string;
}

/** Distance between the pointer and the tooltip's nearest corner. */
export const tooltipGap = 12;

// The tooltip's size is not known before it renders, so the fit test uses the most it can take:
// its `max-w-xs` (20rem) width and about six `text-xs` lines of height.
const tooltipWidthBudget = 320;
const tooltipHeightBudget = 120;

/**
 * Where to draw a hover tooltip, in the canvas box's own coordinates. It sits at the pointer's
 * lower right unless that would run past the box (which clips it) and there is more room on the
 * other side of the pointer, in which case it opens up or to the left instead. A CSS translate
 * flips it, so no measurement of the tooltip is needed.
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
  return {
    left: flipX ? pointer.x - tooltipGap : pointer.x + tooltipGap,
    top: flipY ? pointer.y - tooltipGap : pointer.y + tooltipGap,
    ...(flipX || flipY
      ? {
          transform: `translate(${flipX ? "-100%" : "0"}, ${flipY ? "-100%" : "0"})`,
        }
      : {}),
  };
}
