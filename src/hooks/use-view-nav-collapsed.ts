"use client";

import { useHotkey } from "@tanstack/react-hotkeys";
import { startTransition } from "react";
import { useUiPreference } from "@/lib/ui-preferences/provider";

/** Collapsed state of the left view rail, shared across shells. */
export function useViewNavCollapsed() {
  const [collapsed, setCollapsed] = useUiPreference("viewNavCollapsed");
  const toggle = () => {
    startTransition(() => {
      setCollapsed((current) => !current);
    });
  };
  useHotkey("Mod+B", toggle);
  return { collapsed, toggle };
}
