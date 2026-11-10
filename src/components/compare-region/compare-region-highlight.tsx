"use client";

import {
  use,
  useState,
  type TransitionEvent,
} from "react";
import { featurePaint } from "@/lib/compare-region/colors";
import { rulerHeight } from "@/lib/compare-region/density";
import {
  bridgeRibbons,
  focusMembers,
  resolveFeature,
  type ChartModel,
  type FeatureRef,
} from "@/lib/compare-region/families";
import { glyphBox, glyphKind } from "@/lib/compare-region/figure-frame";
import { glyphPath } from "@/lib/compare-region/glyph-paths";
import { placeGlyph } from "@/lib/compare-region/glyph-placement";
import type { TextMeasure } from "@/lib/compare-region/labels";
import { trackScale, type TrackMatrix } from "@/lib/compare-region/ruler";
import { cn } from "@/lib/utils";
import { HoverContext, PinContext } from "./compare-region-contexts";
import { GlyphMark } from "./compare-region-glyphs";
import { ribbonPaths } from "./compare-region-ribbon-paths";

function useTraceFocus(): {
  hovered: FeatureRef | undefined;
  selected: FeatureRef | null;
  focus: FeatureRef | undefined;
} {
  const hovered = use(HoverContext);
  const selected = use(PinContext);
  return { hovered, selected, focus: hovered ?? selected ?? undefined };
}

const traceFade = "transition-opacity duration-150 ease-out";

function traceKey(
  model: ChartModel,
  focus: FeatureRef | undefined,
): string | null {
  const target = resolveFeature(model.layout, focus);
  if (!target || !focus) return null;
  const { family } = target.feature;
  return family === null
    ? `gene ${String(focus.rowIndex)}:${String(focus.featureIndex)}`
    : `family ${String(family)}`;
}

interface TraceSlots {
  key: string | null;
  focus: FeatureRef | undefined;
  leaving: FeatureRef | undefined;
  current: 0 | 1;
}

function useTraceSlots(model: ChartModel, focus: FeatureRef | undefined) {
  const key = traceKey(model, focus);
  const [slots, setSlots] = useState<TraceSlots>({
    key,
    focus,
    leaving: undefined,
    current: 0,
  });
  let now = slots;
  if (slots.key !== key) {
    now = {
      key,
      focus,
      leaving: slots.focus,
      current: slots.current === 0 ? 1 : 0,
    };
    setSlots(now);
  }
  const drawn: [FeatureRef | undefined, FeatureRef | undefined] =
    now.current === 0 ? [focus, now.leaving] : [now.leaving, focus];
  return {
    drawn,
    current: now.current,
    onLeft: (event: TransitionEvent<SVGGElement>) => {
      if (event.target !== event.currentTarget) return;
      setSlots((previous) =>
        previous.leaving === undefined
          ? previous
          : { ...previous, leaving: undefined },
      );
    },
  };
}

interface RingProps {
  model: ChartModel;
  at: FeatureRef;
  x: (offset: number) => number;
  strokeWidth: number;
  className: string;
}

function Ring({ model, at, x, strokeWidth, className }: RingProps) {
  const item = model.layout.rows.at(at.rowIndex)?.features.at(at.featureIndex);
  const rowFrame = model.frame.rows.at(at.rowIndex);
  if (!item || !rowFrame) return null;
  const { spec } = model;
  const kind = glyphKind(item.feature);
  const box = glyphBox(spec, rowFrame, item);
  const pad = strokeWidth + 0.5;
  return (
    <path
      d={glyphPath(
        spec,
        kind,
        x(item.from),
        x(item.to),
        box.top - pad,
        box.bottom + pad,
      )}
      fill="none"
      className={className}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
  );
}

interface TraceProps {
  model: ChartModel;
  at: FeatureRef;
  x: (offset: number) => number;
  plotWidth: number;
  reach: number;
  measure: TextMeasure;
}

function Trace({ model, at, x, plotWidth, reach, measure }: TraceProps) {
  const members = focusMembers(model, at);
  const family =
    members.length > 0
      ? (resolveFeature(model.layout, at)?.feature.family ?? null)
      : null;
  const ribbons =
    family === null ? [] : (model.families.ribbonsByFamily.get(family) ?? []);
  const bridges =
    family === null ? [] : bridgeRibbons(model.layout, model.families, family);
  const { frame, spec } = model;
  return (
    <>
      {bridges.length > 0 && (
        <g className="opacity-25">
          {ribbonPaths(model, bridges, x, plotWidth, reach)}
        </g>
      )}
      {family !== null && (
        <g className="opacity-55 dark:opacity-50">
          {ribbonPaths(model, ribbons, x, plotWidth, reach)}
        </g>
      )}
      {members.map((ref) => {
        const placed = model.layout.rows.at(ref.rowIndex);
        const item = placed?.features.at(ref.featureIndex);
        const rowFrame = frame.rows.at(ref.rowIndex);
        if (!placed || !item || !rowFrame) return null;
        const glyph = placeGlyph(
          spec,
          rowFrame,
          item,
          x,
          plotWidth,
          measure,
          reach,
        );
        if (!glyph) return null;
        return (
          <GlyphMark
            key={`${String(ref.rowIndex)}:${String(ref.featureIndex)}`}
            spec={spec}
            kind={glyph.kind}
            d={glyph.d}
            fill={featurePaint(item.feature)}
            pinned={item.feature.fid === placed.row.pinnedFid}
            faded={false}
            label={glyph.label}
          />
        );
      })}
    </>
  );
}

/** It covers the plot, so it stays put while a drag slides the trace (`PannedLayers`). */
export function TraceVeil({
  model,
  plotWidth,
}: {
  model: ChartModel;
  plotWidth: number;
}) {
  const { focus } = useTraceFocus();
  const traced = focusMembers(model, focus).length > 0;
  return (
    <rect
      x={0}
      y={rulerHeight}
      width={plotWidth}
      height={model.frame.height - rulerHeight}
      pointerEvents="none"
      data-overlay=""
      data-trace-veil=""
      className={cn("fill-card", traceFade, traced ? "opacity-80" : "opacity-0")}
    />
  );
}

interface HighlightLayerProps {
  model: ChartModel;
  matrix: TrackMatrix;
  plotWidth: number;
  reach: number;
  measure: TextMeasure;
}

export function HighlightLayer({
  model,
  matrix,
  plotWidth,
  reach,
  measure,
}: HighlightLayerProps) {
  const { hovered, selected, focus } = useTraceFocus();
  const { drawn, current, onLeft } = useTraceSlots(model, focus);
  const x = trackScale(model.layout.domain, matrix, plotWidth);
  const { spec } = model;
  return (
    <g pointerEvents="none" data-overlay="">
      {drawn.map((at, slot) => (
        <g
          key={slot}
          data-trace-slot=""
          className={cn(
            traceFade,
            slot === current ? "opacity-100" : "opacity-0",
          )}
          onTransitionEnd={slot === current ? undefined : onLeft}
        >
          {at && (
            <Trace
              model={model}
              at={at}
              x={x}
              plotWidth={plotWidth}
              reach={reach}
              measure={measure}
            />
          )}
        </g>
      ))}
      {selected && (
        <Ring
          model={model}
          at={selected}
          x={x}
          strokeWidth={spec.ringWidth}
          className="stroke-primary dark:stroke-link"
        />
      )}
      {hovered && (
        <Ring
          key={`${String(hovered.rowIndex)}:${String(hovered.featureIndex)}`}
          model={model}
          at={hovered}
          x={x}
          strokeWidth={1.25}
          className={cn("stroke-foreground/70 starting:opacity-0", traceFade)}
        />
      )}
    </g>
  );
}

export function LabelHighlight({
  model,
  labelWidth,
}: {
  model: ChartModel;
  labelWidth: number;
}) {
  const { focus } = useTraceFocus();
  const members = focusMembers(model, focus);
  const traced = members.length > 0;
  const target = traced ? resolveFeature(model.layout, focus) : undefined;
  const color = target ? featurePaint(target.feature) : undefined;
  const rowsWith = new Set(members.map((ref) => ref.rowIndex));
  return (
    <g pointerEvents="none" data-overlay="">
      {model.frame.rows.map((rowFrame, rowIndex) => {
        const holds = rowsWith.has(rowIndex);
        const height = rowFrame.slotBottom - rowFrame.slotTop;
        return (
          <g key={rowIndex}>
            <rect
              x={0}
              y={rowFrame.slotTop}
              width={3}
              height={height}
              fill={color}
              data-label-edge=""
              className={cn(
                traceFade,
                color ? undefined : "fill-muted-foreground",
                holds ? "opacity-100" : "opacity-0",
              )}
            />
            <rect
              x={0}
              y={rowFrame.slotTop}
              width={labelWidth - 1}
              height={height}
              data-label-fade=""
              className={cn(
                "fill-card",
                traceFade,
                traced && !holds ? "opacity-70" : "opacity-0",
              )}
            />
          </g>
        );
      })}
    </g>
  );
}
