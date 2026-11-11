/**
 * Runs after React commits and before the browser paints. The strip's scroll position
 * and content width tween together as a scroll tween, not a transform, which would
 * change the scroll range mid-animation and get clamped.
 */

const duration = 180;
const easing = "cubic-bezier(0.33, 1, 0.68, 1)";
const timing: KeyframeAnimationOptions = { duration, easing };

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

const runningScrolls = new WeakMap<HTMLElement, number>();
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
  // Same-depth moves leave the strip where the user scrolled it, or let a running glide
  // finish.
  const sameDepth =
    snapshot !== null && snapshot.depth === depth && snapshot.place === place;
  if (sameDepth) return;

  // Exit copies from an interrupted move would fade over the new layout, so cancel them.
  overlay.replaceChildren();
  const running = runningScrolls.get(strip);
  if (running !== undefined) cancelAnimationFrame(running);
  runningScrolls.delete(strip);
  content.style.width = "";
  content.style.overflow = "";

  const animate = snapshot !== null && !prefersReducedMotion();
  const toWidth = strip.scrollWidth;
  const shift = snapshot ? snapshot.scrollLeft - scrollLeft : 0;
  if (
    !snapshot ||
    !animate ||
    (shift === 0 && snapshot.scrollWidth === toWidth)
  ) {
    strip.scrollTo({ left: scrollLeft, behavior: "instant" });
  } else {
    // Tween the content width along with the position so the scroll thumb resizes
    // smoothly; `overflow: clip` keeps a too-wide column from extending the scroll range
    // meanwhile.
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
      // A frame's timestamp can predate `start`.
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
