"use client";

import { useSyncExternalStore } from "react";
import type { copilotMarkdownElement } from "./copilot-markdown";

// The markdown renderer (react-markdown, remark, GFM) loads on its own, so the
// `/copilot` page does not carry it in its first bundle. Import
// `CopilotMarkdown` from here, never from `./copilot-markdown`, which would put
// it back. A module-level store rather than `React.lazy`: a lazy component
// suspends on its first render even once loaded, and a suspended answer shows
// its fallback for a frame.
type DrawMarkdown = typeof copilotMarkdownElement;

let drawMarkdown: DrawMarkdown | null = null;
let settled = false;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

function settle(loaded: DrawMarkdown | null): void {
  drawMarkdown = loaded;
  settled = true;
  // A failed load is tried again by the next chat to show.
  if (!loaded) pending = null;
  for (const listener of listeners) listener();
}

/**
 * Starts loading the renderer (once), and resolves when the load has settled.
 * It never rejects: a failed load leaves answers as plain text.
 */
export function loadCopilotMarkdown(): Promise<void> {
  if (!pending) {
    pending = import("./copilot-markdown").then(
      (module) => {
        settle(module.copilotMarkdownElement);
      },
      () => {
        settle(null);
      },
    );
  }
  return pending;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // The first chat to show starts the load, if the page has not already.
  void loadCopilotMarkdown();
  return () => {
    listeners.delete(listener);
  };
}

function readSettled(): boolean {
  return settled;
}

function readDrawMarkdown(): DrawMarkdown | null {
  return drawMarkdown;
}

function notSettled(): boolean {
  return false;
}

function notLoaded(): null {
  return null;
}

/**
 * True once the renderer has loaded, or failed to. The panel holds the chat's
 * skeleton until then, so a stored answer never shows as plain text first and
 * nothing streams before the renderer is in. It never turns false again.
 */
export function useCopilotMarkdownReady(): boolean {
  return useSyncExternalStore(subscribe, readSettled, notSettled);
}

/**
 * An answer's markdown, or its text as written while the renderer is not in
 * (an answer drawn outside the panel, or a failed load).
 */
export function CopilotMarkdown({ content }: { content: string }) {
  const draw = useSyncExternalStore(subscribe, readDrawMarkdown, notLoaded);
  if (draw) return draw(content);
  return (
    <div className="text-sm leading-relaxed wrap-break-word whitespace-pre-wrap">
      {content}
    </div>
  );
}
