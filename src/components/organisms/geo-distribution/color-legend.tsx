"use client";

import { numberFormatter } from "@/lib/services/organisms/utils";

import { accentPalettes } from "./color-scale";
import type { GeoDistributionAccent } from "./types";

interface ColorLegendProps {
  maxCount: number;
  accent: GeoDistributionAccent;
}

export function ColorLegend({ maxCount, accent }: ColorLegendProps) {
  const palette = accentPalettes[accent];

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="tabular-nums">0</span>
      <div
        className="h-2 w-40 rounded-sm border"
        style={{
          background: `linear-gradient(to right, ${palette.light}, ${palette.dark})`,
        }}
        aria-hidden
      />
      <span className="tabular-nums">{numberFormatter.format(maxCount)}</span>
      <span className="ml-1">Genomes</span>
    </div>
  );
}
