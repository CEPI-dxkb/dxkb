"use client";

import { useSyncExternalStore } from "react";
import { readStorageItem, subscribeToStorage } from "@/lib/browser-storage";

/** The raw stored string, or null; server render and hydration always see null so markup never mismatches. */
export function useStorageItem(key: string): string | null {
  return useSyncExternalStore(
    subscribeToStorage,
    () => readStorageItem(key),
    () => null,
  );
}
