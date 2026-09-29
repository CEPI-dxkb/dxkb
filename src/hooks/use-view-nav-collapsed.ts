"use client";

import { useHotkey } from "@tanstack/react-hotkeys";
import { startTransition } from "react";
import { useUiPreference } from "@/lib/ui-preferences/provider";

/**
 * Collapsed state of the left view rail, shared by LandingShellClient and
 * EntityViewShell so it survives moving between them (organism → taxon) and
 * page refreshes. Toggled by the rail button or Mod+B.
 */
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
