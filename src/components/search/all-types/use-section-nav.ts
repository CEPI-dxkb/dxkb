import { useEffect, useRef, useState, type RefObject } from "react";

/** The DOM id of a section's scroll target. */
export function sectionAnchorId(id: string): string {
  return `search-${id}`;
}

/** How long a section jumped to keeps its highlight ring. */
export const sectionFlashMs = 1400;

/** Where `element` sits in `container`'s scroll coordinates. */
function scrollTopOf(element: HTMLElement, container: HTMLElement): number {
  return (
    element.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop
  );
}

/**
 * A rail of sections in one scroll area: `active` is the section at the top of
 * the area as it scrolls, and `select` jumps to one.
 *
 * The last sections can be too near the end to ever reach the top, so a jump
 * highlights its section at once and holds it until the user scrolls by hand
 * (wheel, touch, keys, or a scroll away from where the jump was headed, as a
 * scrollbar drag makes), and a column scrolled to the bottom highlights the
 * last section.
 */
export function useSectionNav({
  ref,
  topInset,
  ids,
  offset = 16,
}: {
  /** The scroll area. */
  ref: RefObject<HTMLElement | null>;
  /** An element pinned at the area's top (a sticky header): sections stop below it. */
  topInset?: RefObject<HTMLElement | null>;
  /** Section ids, top to bottom; each anchored at `sectionAnchorId(id)`. */
  ids: readonly string[];
  /** The gap kept above a section scrolled to the top. */
  offset?: number;
}) {
  const [active, setActive] = useState<string | undefined>(undefined);
  // The jump being held: where its smooth scroll is headed, and how far off it
  // was at the last scroll event. The spy leaves the section jumped to
  // highlighted until a hand scroll.
  const jumpRef = useRef<{ top: number; distance: number } | null>(null);
  const key = ids.join(",");

  useEffect(() => {
    const container = ref.current;
    const list = key ? key.split(",") : [];
    if (!container || list.length === 0) return;

    let frame = 0;
    const spy = () => {
      frame = 0;
      if (jumpRef.current) return;
      if (
        container.scrollTop > 0 &&
        container.scrollTop + container.clientHeight >=
          container.scrollHeight - 2
      ) {
        setActive(list.at(-1));
        return;
      }
      const line =
        container.getBoundingClientRect().top +
        (topInset?.current?.offsetHeight ?? 0) +
        offset +
        8;
      let current = list[0];
      for (const id of list) {
        const element = document.getElementById(sectionAnchorId(id));
        if (element && element.getBoundingClientRect().top <= line)
          current = id;
      }
      setActive(current);
    };
    const onScroll = () => {
      const jump = jumpRef.current;
      if (jump) {
        // The smooth scroll only ever closes in on its target, so moving away
        // from it is the user, on the scrollbar or anything else.
        const distance = Math.abs(container.scrollTop - jump.top);
        if (distance > jump.distance + 1) jumpRef.current = null;
        else jump.distance = distance;
      }
      if (!frame) frame = requestAnimationFrame(spy);
    };
    const unlock = () => {
      if (!jumpRef.current) return;
      jumpRef.current = null;
      onScroll();
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    container.addEventListener("wheel", unlock, { passive: true });
    container.addEventListener("touchstart", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    onScroll();
    return () => {
      cancelAnimationFrame(frame);
      container.removeEventListener("scroll", onScroll);
      container.removeEventListener("wheel", unlock);
      container.removeEventListener("touchstart", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [ref, topInset, key, offset]);

  /** Highlight `id`, scroll its section to the top and flash it. */
  const select = (id: string) => {
    const container = ref.current;
    const element = document.getElementById(sectionAnchorId(id));
    if (!container || !element) return;
    const top =
      scrollTopOf(element, container) -
      (topInset?.current?.offsetHeight ?? 0) -
      offset;
    // Where the scroll will stop: the browser clamps a section near the end.
    const stop = Math.max(
      0,
      Math.min(top, container.scrollHeight - container.clientHeight),
    );
    jumpRef.current = {
      top: stop,
      distance: Math.abs(container.scrollTop - stop),
    };
    setActive(id);
    container.scrollTo({
      top,
      // An explicit "smooth" overrides the reduced-motion `scroll-behavior`
      // in globals.css, so the preference is honored here.
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
    element.dataset.flash = "";
    window.setTimeout(() => {
      delete element.dataset.flash;
    }, sectionFlashMs);
  };

  return { active: active ?? ids.at(0), select };
}
