import { type FocusEvent, useEffect, useRef, useState } from "react";

/**
 * Open/close state for a panel attached to a card. A pointer opens it after a
 * short intent delay and focus inside opens it at once; leaving, focus moving
 * out, or Escape closes it. `toggle` pins it open, which is the touch and
 * keyboard path (a tap does not hover): a pinned panel stays through pointer
 * leave and closes on the next press outside it.
 */
export function useHoverDisclosure(openDelayMs = 120) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (!pinned) return;
    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setPinned(false);
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [pinned]);

  // Escape dismisses the panel wherever focus is: a hover-opened panel has no
  // focus inside it, so a keydown handler on the wrapper would never see it.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      clearTimeout(timer.current);
      setPinned(false);
      setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function close() {
    clearTimeout(timer.current);
    setPinned(false);
    setOpen(false);
  }

  function toggle() {
    clearTimeout(timer.current);
    setPinned(!pinned);
    setOpen(!pinned);
  }

  const handlers = {
    onMouseEnter() {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setOpen(true);
      }, openDelayMs);
    },
    onMouseLeave() {
      clearTimeout(timer.current);
      if (!pinned) setOpen(false);
    },
    onFocus() {
      clearTimeout(timer.current);
      setOpen(true);
    },
    onBlur(event: FocusEvent<HTMLDivElement>) {
      if (!event.currentTarget.contains(event.relatedTarget)) close();
    },
  };

  return { ref, open, toggle, handlers };
}
