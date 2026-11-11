"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { HexColorPicker } from "react-colorful";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const swatches = [
  "#000F7D", "#307D32", "#833B76", "#21DFD7", "#FF0000", "#FFA500", "#0000FF",
  "#000000", "#EBD4F4", "#F3CDA0", "#FFEFD5", "#FFFFE0", "#FFFFFF",
] as const;

const hexPattern = /^#[0-9a-f]{6}$/i;

export function TrackColorPicker({
  label,
  hint,
  color,
  darkColor = null,
  onChange,
}: {
  label: string;
  hint: string;
  color: string | null;
  darkColor?: string | null;
  onChange: (color: string) => void;
}) {
  const [draft, setDraft] = useState(color ?? "");
  // A drag reports every pointer move and the figure redraws the track on each
  // commit, so a drag commits at most once a frame.
  const dragged = useRef<{ color: string; frame: number } | null>(null);
  useEffect(
    () => () => {
      if (dragged.current) cancelAnimationFrame(dragged.current.frame);
    },
    [],
  );
  function commitOnNextFrame(next: string) {
    if (dragged.current) {
      dragged.current.color = next;
      return;
    }
    dragged.current = {
      color: next,
      frame: requestAnimationFrame(() => {
        const latest = dragged.current?.color;
        dragged.current = null;
        if (latest !== undefined) onChange(latest);
      }),
    };
  }
  function commit(next: string) {
    if (dragged.current) cancelAnimationFrame(dragged.current.frame);
    dragged.current = null;
    onChange(next);
  }
  return (
    <Popover
      onOpenChange={(open) => {
        if (open) setDraft(color ?? "");
      }}
    >
      <Tooltip>
        <PopoverTrigger
          render={
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={label}
                  className="grid size-6 place-items-center rounded-sm"
                >
                  <span
                    className="size-4 rounded-sm border border-foreground/40 bg-(--swatch) dark:bg-(--swatch-dark)"
                    style={
                      {
                        "--swatch": color ?? "transparent",
                        "--swatch-dark": darkColor ?? color ?? "transparent",
                      } as CSSProperties
                    }
                  />
                </button>
              }
            />
          }
        />
        <TooltipContent aria-hidden="true">{hint}</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-56">
        <div className="space-y-2">
          <HexColorPicker
            color={color ?? "#FFFFFF"}
            onChange={(next) => {
              setDraft(next);
              commitOnNextFrame(next);
            }}
          />
          <div className="flex flex-wrap gap-1">
            {swatches.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Use ${swatch}`}
                className="size-5 rounded-sm border border-foreground/30 bg-(--swatch)"
                style={{ "--swatch": swatch } as CSSProperties}
                onClick={() => {
                  setDraft(swatch);
                  commit(swatch);
                }}
              />
            ))}
          </div>
          <Input
            aria-label={`${label}, hex value`}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (hexPattern.test(event.target.value)) commit(event.target.value);
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
