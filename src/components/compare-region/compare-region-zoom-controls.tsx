"use client";

/**
 * The command bar's zoom cluster: − / slider / + / level / Fit. Each button
 * disables at its limit (1× and `maxZoom`), and everything disables while
 * there is no chart.
 */
import { Maximize2, Minus, Plus } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { maxZoom } from "@/lib/compare-region/layout";
import {
  formatZoomLevel,
  zoomSliderValue,
  zoomStep,
} from "@/lib/compare-region/zoom";

/** What the bar needs from the chart's `<Zoom>`; null while there is no chart. */
export interface ZoomControls {
  level: number;
  maxZoom: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  /** Multiply the zoom, about the focus line when it is in view. */
  zoomBy: (factor: number) => void;
  fit: () => void;
}

export function ZoomCluster({ zoom }: { zoom: ZoomControls | null }) {
  const labelId = useId();
  const level = zoom?.level ?? 1;
  const max = zoom?.maxZoom ?? maxZoom;
  return (
    <div className="flex h-7 items-center gap-1 rounded-lg border bg-background/60 px-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Zoom out"
        disabled={!zoom?.canZoomOut}
        onClick={() => zoom?.zoomBy(1 / zoomStep)}
      >
        <Minus />
      </Button>
      <span id={labelId} className="sr-only">
        Zoom level
      </span>
      <div className="w-20 px-1 lg:w-28">
        <Slider
          aria-labelledby={labelId}
          min={0}
          max={100}
          step={1}
          disabled={!zoom}
          value={[zoomSliderValue(level, max)]}
          // Its position is a log scale: it reads out as the zoom, "2.0×".
          getAriaValueText={() => formatZoomLevel(level)}
          onValueChange={(value: number | readonly number[]) => {
            const next = typeof value === "number" ? value : value.at(0);
            if (!zoom || next === undefined) return;
            zoom.zoomBy(max ** (next / 100) / level);
          }}
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Zoom in"
        disabled={!zoom?.canZoomIn}
        onClick={() => zoom?.zoomBy(zoomStep)}
      >
        <Plus />
      </Button>
      <output
        aria-live="polite"
        className="w-9 text-right font-mono text-2xs text-muted-foreground tabular-nums"
      >
        {formatZoomLevel(level)}
      </output>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        aria-label="Fit the whole region"
        disabled={!zoom?.canZoomOut}
        onClick={() => zoom?.fit()}
      >
        <Maximize2 />
        Fit
      </Button>
    </div>
  );
}
