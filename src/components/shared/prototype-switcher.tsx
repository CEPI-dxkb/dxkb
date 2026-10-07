"use client";

/**
 * PROTOTYPE TOOLING — throwaway. A floating bar that flips between UI
 * prototype variants through a `?variant=` search param. Hidden in production
 * builds unless `NEXT_PUBLIC_PROTOTYPES=1`. Delete together with the last
 * prototype that uses it.
 */

import { useEffect, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toQueryString } from "@/lib/url";

export interface PrototypeVariant {
  key: string;
  name: string;
}

const paramName = "variant";
const changeEvent = "prototype-variant-change";

export const prototypesEnabled =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_PROTOTYPES === "1";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(changeEvent, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(changeEvent, onChange);
  };
}

function readParam(): string | null {
  return new URLSearchParams(window.location.search).get(paramName);
}

function readServerParam(): string | null {
  return null;
}

/** The active variant key; the first variant when unset, unknown, or in prod. */
export function usePrototypeVariant(
  variants: readonly PrototypeVariant[],
): string {
  const raw = useSyncExternalStore(subscribe, readParam, readServerParam);
  const fallback = variants[0]?.key ?? "";
  if (!prototypesEnabled) return fallback;
  return variants.some((variant) => variant.key === raw) && raw
    ? raw
    : fallback;
}

function writeVariant(key: string) {
  const params = new URLSearchParams(window.location.search);
  params.set(paramName, key);
  const query = toQueryString(params);
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
  );
  window.dispatchEvent(new Event(changeEvent));
}

/** Arrow keys belong to whatever widget has focus inside these. */
const keyboardOwners =
  'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="tree"], [role="grid"], [role="listbox"], [role="menu"], [cmdk-root], [data-slot="popover-content"], [data-slot="sheet-content"]';

export function PrototypeSwitcher({
  variants,
}: {
  variants: readonly PrototypeVariant[];
}) {
  const current = usePrototypeVariant(variants);
  const index = Math.max(
    0,
    variants.findIndex((variant) => variant.key === current),
  );

  const cycle = (step: number) => {
    writeVariant(variants[(index + step + variants.length) % variants.length].key);
  };

  useEffect(() => {
    if (!prototypesEnabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.defaultPrevented || event.altKey || event.metaKey) return;
      if (event.ctrlKey || event.shiftKey) return;
      if (event.target instanceof Element && event.target.closest(keyboardOwners))
        return;
      const step = event.key === "ArrowLeft" ? -1 : 1;
      writeVariant(
        variants[(index + step + variants.length) % variants.length].key,
      );
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [index, variants]);

  if (!prototypesEnabled || variants.length === 0) return null;
  const active = variants[index];

  return (
    <div
      role="toolbar"
      aria-label="Prototype variants"
      className="fixed bottom-4 left-1/2 z-60 flex -translate-x-1/2 items-center gap-1 rounded-full bg-foreground p-1 text-xs text-background shadow-xl ring-4 ring-foreground/20"
    >
      <button
        type="button"
        aria-label="Previous variant"
        className="flex size-7 items-center justify-center rounded-full hover:bg-background/20"
        onClick={() => {
          cycle(-1);
        }}
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-48 px-2 text-center font-medium tabular-nums">
        {`${active.key} — ${active.name}`}
        <span className="ml-2 opacity-60">
          {index + 1}/{variants.length}
        </span>
      </span>
      <button
        type="button"
        aria-label="Next variant"
        className="flex size-7 items-center justify-center rounded-full hover:bg-background/20"
        onClick={() => {
          cycle(1);
        }}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
