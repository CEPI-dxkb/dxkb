"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Reads the `rerun_key` query param from the current URL, retrieves the
 * matching JSON blob from sessionStorage, removes the key, and returns
 * the parsed job parameters.
 */
export function useRerunForm<T extends Record<string, unknown>>(): {
  rerunData: T | null;
} {
  const searchParams = useSearchParams();
  const [rerunData, setRerunData] = useState<T | null>(null);

  useEffect(() => {
    const key = searchParams.get("rerun_key");
    if (!key) return;

    const stored = sessionStorage.getItem(key);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as T;
      setRerunData(parsed);
    } catch {
      console.error("[useRerunForm] Failed to parse rerun data from sessionStorage");
    }
    sessionStorage.removeItem(key);
    // Only run once on mount — searchParams is stable on first render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { rerunData };
}
