"use client";

import { useState, useRef, useCallback } from "react";

/**
 * Reads the `rerun_key` query param from the current URL, retrieves the
 * matching JSON blob from sessionStorage, removes the key, and returns
 * the parsed job parameters.
 *
 * Initializes state lazily on mount so no effects are needed.
 * `markApplied` is a stable callback that returns `false` if rerun has
 * already been applied, preventing duplicate effect runs.
 */
export function useRerunForm<T extends Record<string, unknown>>(): {
  rerunData: T | null;
  markApplied: () => boolean;
} {
  const applied = useRef(false);
  const [rerunData] = useState<T | null>(() => {
    if (typeof window === "undefined") return null;

    const key = new URLSearchParams(window.location.search).get("rerun_key");
    if (!key) return null;

    const stored = sessionStorage.getItem(key);
    if (!stored) return null;

    try {
      const parsed = JSON.parse(stored) as T;
      sessionStorage.removeItem(key);
      return parsed;
    } catch {
      console.error("[useRerunForm] Failed to parse rerun data from sessionStorage");
      return null;
    }
  });

  const markApplied = useCallback(() => {
    if (applied.current) return false;
    applied.current = true;
    return true;
  }, []);

  return { rerunData, markApplied };
}
