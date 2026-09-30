"use client";

import { useSyncExternalStore } from "react";
import { readStorageItem, subscribeToStorage } from "@/lib/browser-storage";

/**
 * The raw string stored under `key`, or null. The server render and hydration
 * always see null, so markup never depends on storage and cannot mismatch; the
 * stored value arrives in the render right after hydration. Callers parse the
 * string themselves — a string snapshot is stable by value, as
 * useSyncExternalStore requires.
 */
export function useStorageItem(key: string): string | null {
  return useSyncExternalStore(
    subscribeToStorage,
    () => readStorageItem(key),
    () => null,
  );
}
