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

// The header layout under test (`?header=`), kept the same way. "0" is today's header, with no
// button for the full page.
export const headerKeys = ["0", "1", "2", "3"] as const;
export type HeaderKey = (typeof headerKeys)[number];

export const headerNames: Record<HeaderKey, string> = {
  "0": "Today",
  "1": "Two rows",
  "2": "Regrouped",
  "3": "Layout menu",
};

let currentHeader: HeaderKey | undefined;
const headerListeners = new Set<() => void>();

function isHeaderKey(value: string | null): value is HeaderKey {
  return headerKeys.some((key) => key === value);
}

function readHeader(): HeaderKey {
  if (currentHeader === undefined) {
    const param = new URLSearchParams(window.location.search).get("header");
    currentHeader = isHeaderKey(param) ? param : "3";
  }
  return currentHeader;
}

function subscribeHeader(onChange: () => void): () => void {
  headerListeners.add(onChange);
  return () => {
    headerListeners.delete(onChange);
  };
}

export function setAskClarkHeader(next: HeaderKey): void {
  currentHeader = next;
  replaceQuery((params) => {
    params.set("header", next);
  });
  headerListeners.forEach((listener) => {
    listener();
  });
}

/** The key behind the switcher; the panel header uses {@link useAskClarkHeader}. */
export function useAskClarkHeaderKey(): HeaderKey {
  return useSyncExternalStore(subscribeHeader, readHeader, () => "3");
}

/** "0" (today's header) unless a prototype variant is active, and always in production. */
export function useAskClarkHeader(): HeaderKey {
  const dock = useAskClarkDock();
  const key = useAskClarkHeaderKey();
  return dock ? key : "0";
}
