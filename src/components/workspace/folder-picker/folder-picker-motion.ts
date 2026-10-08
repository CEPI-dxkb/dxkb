/**
 * The folder picker's motion when going into or out of a folder.
 *
 * Going in, a column fades in from slightly to the right; going out, the
 * right-hand column fades out the same way in reverse. When the strip has to
 * scroll, the columns glide to their new place instead of jumping. Same-depth
 * moves (↑ / ↓ in a column) don't animate the columns.
 *
 * It runs after React has committed and before the browser paints. The strip's
 * scroll position and content width glide together from where they were to
 * where they should be (a scroll tween, not a transform: transforming the
 * scrolled content changes its scroll range mid-animation and the browser
 * clamps the position). Columns
 * fade in or out with the Web Animations API. A column that is going away is
 * already out of the DOM by then, so a copy of it plays the exit on an overlay
 * above the strip.
 */

const duration = 180;
/** easeOutCubic, shared by the scroll tween and the column animations. */
const easing = "cubic-bezier(0.33, 1, 0.68, 1)";
const timing: KeyframeAnimationOptions = { duration, easing };

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

/** The scroll tween running on each strip, so a new one can cancel it. */
const runningScrolls = new WeakMap<HTMLElement, number>();
/** How far a column slides as it appears or goes away. */
const nudge = 12;

const columnSelector = "[data-picker-key]";

interface ColumnSnapshot {
  key: string;
  node: HTMLElement;
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The strip as it is on screen just before a navigation. */
export interface ColumnsSnapshot {
  place: string;
  depth: number;
  scrollLeft: number;
  scrollWidth: number;
  columns: ColumnSnapshot[];
}

function keyOf(element: HTMLElement): string {
  return element.dataset.pickerKey ?? "";
}

export function captureColumns({
  strip,
  overlay,
  place,
  depth,
}: {
  strip: HTMLElement;
  overlay: HTMLElement;
  place: string;
  depth: number;
}): ColumnsSnapshot {
  const origin = overlay.getBoundingClientRect();
  return {
    place,
    depth,
    scrollLeft: strip.scrollLeft,
    scrollWidth: strip.scrollWidth,
    columns: [...strip.querySelectorAll<HTMLElement>(columnSelector)].map(
      (node) => {
        const rect = node.getBoundingClientRect();
        return {
          key: keyOf(node),
          node,
          left: rect.left - origin.left,
          top: rect.top - origin.top,
          width: rect.width,
          height: rect.height,
        };
      },
    ),
  };
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Scroll the strip to `scrollLeft` and, if the depth or place changed since
 * `snapshot`, animate from the snapshot to the new layout.
 */
export function playColumnTransition({
  strip,
  content,
  overlay,
  snapshot,
  scrollLeft,
  place,
  depth,
}: {
  strip: HTMLElement;
  content: HTMLElement;
  overlay: HTMLElement;
  snapshot: ColumnsSnapshot | null;
  scrollLeft: number;
  place: string;
  depth: number;
}) {
  // ↑ / ↓ within a column keeps the same columns, so leave the strip where it
  // is: wherever the user scrolled it, or a glide still running finishes.
  // Snapping it back to the computed position on every press made the scroll
  // bar jump.
  const sameDepth =
    snapshot !== null && snapshot.depth === depth && snapshot.place === place;
  if (sameDepth) return;

  // Exit copies from a move this one interrupts sit where the columns were
  // before it; left to finish, they fade over the new layout (going back in,
  // over the very column that is fading in again).
  overlay.replaceChildren();
  const running = runningScrolls.get(strip);
  if (running !== undefined) cancelAnimationFrame(running);
  runningScrolls.delete(strip);
  content.style.width = "";
  content.style.overflow = "";

  const animate = snapshot !== null && !prefersReducedMotion();
  // The strip's scroll range now, with the new columns and no tween styles.
  const toWidth = strip.scrollWidth;
  // How far the columns move on screen: positive when they move right.
  const shift = snapshot ? snapshot.scrollLeft - scrollLeft : 0;
  if (
    !snapshot ||
    !animate ||
    (shift === 0 && snapshot.scrollWidth === toWidth)
  ) {
    strip.scrollTo({ left: scrollLeft, behavior: "instant" });
  } else {
    // The scroll bar's thumb is sized by the content width, which React just
    // changed in one step (a column added or removed). Tween the width along
    // with the position so the thumb resizes and moves smoothly together,
    // instead of snapping at the start (going in) or the end (going out).
    // `overflow: clip` keeps a wider-than-allowed column from adding to the
    // scroll range while the width catches up.
    const fromWidth = snapshot.scrollWidth;
    const fromLeft = snapshot.scrollLeft;
    const tween = (eased: number) => {
      content.style.width = `${String(fromWidth + (toWidth - fromWidth) * eased)}px`;
      strip.scrollLeft = fromLeft - shift * eased;
    };
    content.style.overflow = "clip";
    tween(0);
    const start = performance.now();
    const step = (now: number) => {
      // A frame's timestamp can predate `start`; never run the tween backwards.
      const progress = Math.min(1, Math.max(0, (now - start) / duration));
      tween(easeOutCubic(progress));
      if (progress < 1) {
        runningScrolls.set(strip, requestAnimationFrame(step));
      } else {
        runningScrolls.delete(strip);
        content.style.width = "";
        content.style.overflow = "";
        strip.scrollLeft = scrollLeft;
      }
    };
    runningScrolls.set(strip, requestAnimationFrame(step));
  }
  if (!snapshot || !animate) return;

  const before = new Set(snapshot.columns.map((column) => column.key));
  const now = [...strip.querySelectorAll<HTMLElement>(columnSelector)];
  const present = new Set(now.map(keyOf));

  for (const column of now) {
    if (before.has(keyOf(column))) continue;
    column.animate(
      [
        { opacity: 0, transform: `translateX(${String(nudge)}px)` },
        { opacity: 1, transform: "none" },
      ],
      timing,
    );
  }

  for (const column of snapshot.columns) {
    if (present.has(column.key)) continue;
    const ghost = column.node.cloneNode(true) as HTMLElement;
    ghost.removeAttribute("data-picker-key");
    ghost.removeAttribute("data-picker-column");
    ghost.inert = true;
    ghost.setAttribute("aria-hidden", "true");
    Object.assign(ghost.style, {
      position: "absolute",
      left: `${String(column.left)}px`,
      top: `${String(column.top)}px`,
      width: `${String(column.width)}px`,
      height: `${String(column.height)}px`,
      margin: "0",
    });
    overlay.append(ghost);
    const exit = ghost.animate(
      [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: `translateX(${String(shift + nudge)}px)` },
      ],
      { ...timing, fill: "forwards" },
    );
    exit.onfinish = () => {
      ghost.remove();
    };
  }
}
