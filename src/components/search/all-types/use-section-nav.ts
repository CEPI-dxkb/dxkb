import { useEffect, useRef, useState, type RefObject } from "react";

export function sectionAnchorId(id: string): string {
  return `search-${id}`;
}

export const sectionFlashMs = 1400;

function scrollTopOf(element: HTMLElement, container: HTMLElement): number {
  return (
    element.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop
  );
}

/**
 * Jumping to a section near the end highlights it at once and holds it until
 * the user scrolls by hand, since it may never reach the top.
 */
export function useSectionNav({
  ref,
  topInset,
  ids,
  offset = 16,
}: {
  ref: RefObject<HTMLElement | null>;
  topInset?: RefObject<HTMLElement | null>;
  ids: readonly string[];
  offset?: number;
}) {
  const [active, setActive] = useState<string | undefined>(undefined);
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
        // The smooth scroll only closes in on its target, so moving away from
        // it is the user.
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

  const select = (id: string) => {
    const container = ref.current;
    const element = document.getElementById(sectionAnchorId(id));
    if (!container || !element) return;
    const top =
      scrollTopOf(element, container) -
      (topInset?.current?.offsetHeight ?? 0) -
      offset;
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
      // An explicit "smooth" overrides the reduced-motion `scroll-behavior` in
      // globals.css, so the preference is honored here.
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
