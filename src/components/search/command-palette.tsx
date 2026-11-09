"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { COMMAND_PALETTE_OPEN_EVENT } from "./command-palette-events";

// The dialog, cmdk and its dialog stack load on first open, so they are not
// in the initial bundle of every route. The shell below owns the openers and
// the open state, so the keypress that triggers the load is not lost.
const CommandPaletteBody = dynamic(
  () =>
    import("./command-palette-body").then(
      (module) => module.CommandPaletteBody,
    ),
  { ssr: false },
);

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  // Latches on the first open; the body then stays mounted (closed between
  // uses) so its dialog can animate out and its sign-out form stays present.
  const [hasOpened, setHasOpened] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setInputValue("");
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Case-insensitive: CapsLock or Playwright's `Meta+K` send key="K".
      // Browser autofill selection fires a synthetic keydown with no `key`,
      // which the DOM types don't model — hence the widened alias.
      const key = event.key as string | undefined;
      if (key?.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        // Reset stale input so reopening always starts clean; setInputValue
        // here runs from an event handler, not an effect body.
        setInputValue("");
        setOpen((prev) => !prev);
        setHasOpened(true);
      }
    };

    const onOpen = () => {
      setOpen(true);
      setHasOpened(true);
    };

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpen);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpen);
    };
  }, []);

  if (!hasOpened) return null;

  return (
    <CommandPaletteBody
      open={open}
      onOpenChange={handleOpenChange}
      inputValue={inputValue}
      onInputValueChange={setInputValue}
    />
  );
}
