"use client";

import { useSyncExternalStore } from "react";

function subscribe(listener: () => void): () => void {
  window.addEventListener("resize", listener);
  return () => {
    window.removeEventListener("resize", listener);
  };
}

// Only used where the server snapshot never renders (the lazy picker is client-only),
// but useSyncExternalStore still needs one.
const serverWidth = 1280;
const serverHeight = 800;

export function useViewportSize(): { width: number; height: number } {
  const width = useSyncExternalStore(
    subscribe,
    () => window.innerWidth,
    () => serverWidth,
  );
  const height = useSyncExternalStore(
    subscribe,
    () => window.innerHeight,
    () => serverHeight,
  );
  return { width, height };
}
