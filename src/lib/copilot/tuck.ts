// Minimize and restore for the floating window: it shrinks toward the edge tab and fades out, and
// grows back out of it. Transform and opacity only, so it stays on the compositor and never re-lays
// out the chat. Played with the Web Animations API.

/** The point the window tucks into, in px from the window's top-left corner. */
export interface TuckTarget {
  x: number;
  y: number;
}

export type TuckDirection = "minimize" | "restore";

const minimizeMs = 170;
const restoreMs = 220;
const smallest = 0.25;

/** Frames run from the window at rest to the window gone into the tab (evenly spaced, so they reverse cleanly). */
function tuckFrames(target: TuckTarget): Keyframe[] {
  const common = {
    transformOrigin: `${target.x.toFixed(1)}px ${target.y.toFixed(1)}px`,
    // The resting state of a minimized window is `visibility: hidden`; the motion has to show anyway.
    visibility: "visible",
  };
  return [
    { ...common, transform: "scale(1)", opacity: 1 },
    { ...common, opacity: 0.7 },
    {
      ...common,
      transform: `scale(${String(smallest)})`,
      opacity: 0,
      visibility: "hidden",
    },
  ];
}

/** Plays the tuck on `element`. Returns null, with no motion, for people who ask for reduced motion. */
export function playTuck(
  element: HTMLElement,
  target: TuckTarget,
  direction: TuckDirection,
): Animation | null {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  const frames = tuckFrames(target);
  const minimizing = direction === "minimize";
  return element.animate(minimizing ? frames : frames.toReversed(), {
    duration: minimizing ? minimizeMs : restoreMs,
    // The tucked state is held until the next restore replaces it. Letting go at the end hands the
    // window back to its class styles a frame late, which shows the whole chat once more.
    fill: minimizing ? "forwards" : "none",
    // Leaving speeds up into the tab; arriving decelerates out of it.
    easing: minimizing
      ? "cubic-bezier(0.4, 0, 0.8, 0.5)"
      : "cubic-bezier(0.2, 0.9, 0.25, 1)",
  });
}
