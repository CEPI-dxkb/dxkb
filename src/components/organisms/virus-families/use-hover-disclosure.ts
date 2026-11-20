import { type FocusEvent, useEffect, useRef, useState } from "react";

/**
 * Open/close state for a panel attached to a card. The panel is open while the
 * pointer is inside (after a short intent delay), while focus is inside, or
 * while it is pinned, so neither input can close what the other still holds
 * open. `toggle` pins it, which is the touch and keyboard path (a tap does not
 * hover): a pinned panel stays through pointer leave and closes on the next
 * press outside it, on Tab out, or on Escape.
 *
 * Escape closes it wherever focus is. When focus was inside the panel, the
 * panel is about to unmount, so focus moves to the toggle first; a hover-only
 * panel has no focus to move, and focus elsewhere is left alone.
 */
export function useHoverDisclosure(openDelayMs = 120) {
  const ref = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pointerInside = useRef(false);
  const ignoreFocus = useRef(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || focused || pinned;

  useEffect(() => {
    if (!pinned) return;
    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setHovered(false);
        setFocused(false);
        setPinned(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [pinned]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const active = document.activeElement;
      const toggle = toggleRef.current;
      if (toggle && active && active !== toggle && panelRef.current?.contains(active)) {
        // The toggle's own onFocus would reopen the panel we are closing.
        ignoreFocus.current = true;
        toggle.focus();
        ignoreFocus.current = false;
      }
      clearTimeout(timer.current);
      setHovered(false);
      setFocused(false);
      setPinned(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle() {
    clearTimeout(timer.current);
    if (pinned) {
      setHovered(false);
      setFocused(false);
      setPinned(false);
    } else {
      setPinned(true);
    }
  }

  const handlers = {
    onMouseEnter() {
      pointerInside.current = true;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setHovered(true);
      }, openDelayMs);
    },
    onMouseLeave() {
      pointerInside.current = false;
      clearTimeout(timer.current);
      setHovered(false);
    },
    onFocus() {
      if (!ignoreFocus.current) setFocused(true);
    },
    onBlur(event: FocusEvent<HTMLDivElement>) {
      if (event.currentTarget.contains(event.relatedTarget)) return;
      setFocused(false);
      // Tabbing away unpins, unless the pointer is still on the card.
      if (!pointerInside.current) setPinned(false);
    },
  };

  return { ref, toggleRef, panelRef, open, toggle, handlers };
}
