"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect } from "react";
import {
  setAskClarkVariant,
  variantKeys,
  variantNames,
  type VariantKey,
} from "./dock-state";

function step(current: VariantKey, direction: 1 | -1): VariantKey {
  const index = variantKeys.indexOf(current);
  return variantKeys[(index + direction + variantKeys.length) % variantKeys.length];
}

/**
 * Floating bar at the bottom corner away from the edge tab (bottom-centre sits on the pager, which
 * is what is being judged, and the corner on the tab's side is where the chat opens): arrows (or
 * ←/→) cycle variants; × returns to today's AskClark.
 */
export function PrototypeSwitcher({
  current,
  side,
}: {
  current: VariantKey;
  side: "left" | "right";
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // The edge tab handles (and cancels) the arrow keys itself.
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        target?.closest("input, textarea, select, [contenteditable], [role=menu], [role=listbox]")
      ) {
        return;
      }
      if (event.key === "ArrowLeft") setAskClarkVariant(step(current, -1));
      if (event.key === "ArrowRight") setAskClarkVariant(step(current, 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [current]);

  return (
    <div
      role="toolbar"
      aria-label="AskClark prototype variants"
      data-side={side}
      className="ac-switcher fixed z-60 flex w-56 items-center gap-1 rounded-full bg-foreground p-1 text-xs text-background shadow-2xl"
    >
      <button
        type="button"
        aria-label="Previous variant"
        className="rounded-full p-1.5 hover:bg-background/20"
        onClick={() => {
          setAskClarkVariant(step(current, -1));
        }}
      >
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      <span className="min-w-0 flex-1 truncate px-1 text-center font-medium">
        <span className="font-mono">{current}</span> · {variantNames[current]}
      </span>
      <button
        type="button"
        aria-label="Next variant"
        className="rounded-full p-1.5 hover:bg-background/20"
        onClick={() => {
          setAskClarkVariant(step(current, 1));
        }}
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Exit prototype (today's AskClark)"
        title="Exit prototype (today's AskClark)"
        className="ml-1 rounded-full p-1.5 hover:bg-background/20"
        onClick={() => {
          setAskClarkVariant(null);
        }}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
