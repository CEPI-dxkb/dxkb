"use client";

// PROTOTYPE (DXKBCORE-342): throwaway. Delete this folder, plus the three marked hooks in
// layout.tsx, copilot-surfaces.tsx and copilot-launcher.tsx, once a variant wins.

import { createContext, useContext, useSyncExternalStore } from "react";
import { replaceQuery } from "@/lib/url";

export const variantKeys = ["A", "B", "C", "D"] as const;
export type VariantKey = (typeof variantKeys)[number];

export const variantNames: Record<VariantKey, string> = {
  A: "Side panel · rail",
  B: "Floating · chip",
  C: "Floating · pill",
  D: "Edge tab · both",
};

export type TabSide = "left" | "right";

/** Where the D edge tab sits: which edge, and how far down the window (0–1). */
export interface TabPlacement {
  side: TabSide;
  top: number;
}

export type DockState = "closed" | "open" | "minimized";

export interface DockSummary {
  working: boolean;
  /** Plain text of the live answer, or the newest stored one. */
  preview: string;
}

export interface DockApi {
  variant: VariantKey;
  state: DockState;
  /** True once a turn ran while the dock was minimized. */
  unread: boolean;
  summary: DockSummary;
  minimize: () => void;
  restore: () => void;
  close: () => void;
  /** The edge tab's spot; the side panel docks on the same side. */
  placement: TabPlacement;
  setPlacement: (placement: TabPlacement) => void;
  /** True when the navbar button shows the minimized chat's status as text (B). */
  launcherChip: boolean;
  /** True when, with the chat open, the navbar button minimizes it instead of closing it. */
  launcherMinimizes: boolean;
  /** What the navbar button does in this variant. */
  onLauncherClick: () => void;
}

export interface DockProps {
  api: DockApi;
  size: number;
}

const dockContext = createContext<DockApi | null>(null);
export const DockProvider = dockContext.Provider;

/** Null unless a prototype variant is active (and always null in production). */
export function useAskClarkDock(): DockApi | null {
  const api = useContext(dockContext);
  return process.env.NODE_ENV === "production" ? null : api;
}

// The active variant lives in the URL (`?variant=`) and in this store, which keeps it when a page
// rewrites its own query string (paging, sorting) and drops the param.
let currentVariant: VariantKey | null | undefined;
const listeners = new Set<() => void>();

function isVariantKey(value: string | null): value is VariantKey {
  return variantKeys.some((key) => key === value);
}

function readVariant(): VariantKey | null {
  if (currentVariant === undefined) {
    const param = new URLSearchParams(window.location.search).get("variant");
    currentVariant = isVariantKey(param) ? param : null;
  }
  return currentVariant;
}

function subscribeVariant(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function setAskClarkVariant(next: VariantKey | null): void {
  currentVariant = next;
  replaceQuery((params) => {
    if (next) params.set("variant", next);
    else params.delete("variant");
  });
  listeners.forEach((listener) => {
    listener();
  });
}

export function useAskClarkVariant(): VariantKey | null {
  const variant = useSyncExternalStore(subscribeVariant, readVariant, () => null);
  return process.env.NODE_ENV === "production" ? null : variant;
}
