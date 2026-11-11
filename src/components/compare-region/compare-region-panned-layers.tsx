"use client";

import { useMemo, useState } from "react";
import type { ChartModel, FeatureRef } from "@/lib/compare-region/families";
import type { TextMeasure } from "@/lib/compare-region/labels";
import { heldPanMatrix, panReach } from "@/lib/compare-region/pan";
import type { TrackMatrix } from "@/lib/compare-region/ruler";
import { GlyphLayer } from "./compare-region-glyphs";
import { HighlightLayer, TraceVeil } from "./compare-region-highlight";
import {
  Baselines,
  FocusLine,
  RibbonLayer,
} from "./compare-region-track-layers";

interface PannedLayersProps {
  model: ChartModel;
  matrix: TrackMatrix;
  dragging: boolean;
  pressed: FeatureRef | null;
  tabStop: FeatureRef | null;
  plotWidth: number;
  measure: TextMeasure;
}

export function PannedLayers({
  model,
  matrix,
  dragging,
  pressed,
  tabStop,
  plotWidth,
  measure,
}: PannedLayersProps) {
  const [held, setHeld] = useState<TrackMatrix | null>(null);
  const holding = heldPanMatrix(held, matrix, dragging, plotWidth);
  if (holding !== held) setHeld(holding);
  const drawnAt = holding ?? matrix;
  const reach = holding ? panReach(plotWidth) : 0;
  const kept = holding ? pressed : null;
  const offset = matrix.translateX - drawnAt.translateX;
  const slide = offset === 0 ? undefined : `translate(${String(offset)} 0)`;
  // Memoized by hand: every frame of a pan must hand React these same elements,
  // which the unit tests (uncompiled) check.
  const under = useMemo(
    () => (
      <>
        <Baselines model={model} matrix={drawnAt} plotWidth={plotWidth} />
        <RibbonLayer
          model={model}
          matrix={drawnAt}
          plotWidth={plotWidth}
          reach={reach}
        />
        <FocusLine
          model={model}
          matrix={drawnAt}
          plotWidth={plotWidth}
          reach={reach}
        />
        <GlyphLayer
          model={model}
          matrix={drawnAt}
          plotWidth={plotWidth}
          reach={reach}
          pressed={kept}
          tabStop={tabStop}
          measure={measure}
        />
      </>
    ),
    [model, drawnAt, plotWidth, reach, kept, tabStop, measure],
  );
  const veil = useMemo(
    () => <TraceVeil model={model} plotWidth={plotWidth} />,
    [model, plotWidth],
  );
  const over = useMemo(
    () => (
      <HighlightLayer
        model={model}
        matrix={drawnAt}
        plotWidth={plotWidth}
        reach={reach}
        measure={measure}
      />
    ),
    [model, drawnAt, plotWidth, reach, measure],
  );
  return (
    <>
      <g data-pan="" transform={slide}>
        {under}
      </g>
      {veil}
      <g data-pan="" transform={slide}>
        {over}
      </g>
    </>
  );
}
