"use client";

/**
 * The Compare Region Viewer's family trace. The hovered (else the pinned)
 * gene's family is redrawn over a veil across the track, and the label
 * column marks the rows that hold it. The hovered gene reaches these
 * overlays through `HoverContext` and the pinned one through `PinContext`,
 * and Compact's hovered row reaches its tint through `RowHoverContext`, so
 * the layers under them never re-render on a hover (and what reads only the
 * pin, such as the selection strip, does not either). A new family's trace
 * fades in as the last one fades out (`traceFade`), and the veil and the
 * label column's marks fade with it, so moving from gene to gene never
 * flashes. Every overlay is marked `data-overlay`, which the export drops.
 */
import {
  createContext,
  use,
  useState,
  type ReactNode,
  type TransitionEvent,
} from "react";
import { familyColor, featurePaint } from "@/lib/compare-region/colors";
import { rulerHeight } from "@/lib/compare-region/density";
import {
  bridgeRibbons,
  focusMembers,
  resolveFeature,
  type ChartModel,
  type FeatureRef,
  type Ribbon,
} from "@/lib/compare-region/families";
import { glyphBox, glyphKind } from "@/lib/compare-region/figure-frame";
import { glyphPath } from "@/lib/compare-region/glyph-paths";
import { placeGlyph } from "@/lib/compare-region/glyph-placement";
import type { TextMeasure } from "@/lib/compare-region/labels";
import { ribbonKey, ribbonPath } from "@/lib/compare-region/ribbons";
import { trackScale, type TrackMatrix } from "@/lib/compare-region/ruler";
import { cn } from "@/lib/utils";
import { GlyphMark } from "./compare-region-glyphs";

/** The gene under the pointer; undefined while the tooltip is closed. */
export const HoverContext = createContext<FeatureRef | undefined>(undefined);

/** The pinned gene, or null. */
export const PinContext = createContext<FeatureRef | null>(null);

/** Compact only: the row under the pointer, anywhere across the label column and the track. */
export const RowHoverContext = createContext<number | null>(null);

/** The gene the trace follows: the hovered one, else the pinned one. */
function useTraceFocus(): {
  hovered: FeatureRef | undefined;
  selected: FeatureRef | null;
  focus: FeatureRef | undefined;
} {
  const hovered = use(HoverContext);
  const selected = use(PinContext);
  return { hovered, selected, focus: hovered ?? selected ?? undefined };
}

/**
 * How the trace's parts fade in and out: quick enough to keep up with the
 * pointer, long enough that a new family does not flash in.
 */
const traceFade = "transition-opacity duration-150 ease-out";

/**
 * A trace's identity: the family it follows, or a gene of no family. Every
 * gene of a family draws the same trace, so moving between them changes
 * nothing. Null while nothing is traced.
 */
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
  /** A gene of the trace `key` names (the one traced when it came). */
  focus: FeatureRef | undefined;
  /** The trace before it, fading out until its fade ends. */
  leaving: FeatureRef | undefined;
  /** Which of the two slots draws the current trace; the other fades out. */
  current: 0 | 1;
}

/**
 * The two slots the trace crossfades between: on a new trace, the slot that
 * was fading out takes it and fades in, and the current one fades out with
 * the trace it holds. The current slot always draws the live focus.
 */
function useTraceSlots(model: ChartModel, focus: FeatureRef | undefined) {
  const key = traceKey(model, focus);
  const [slots, setSlots] = useState<TraceSlots>({
    key,
    focus,
    leaving: undefined,
    current: 0,
  });
  let now = slots;
  // Set while rendering (React re-renders at once, before committing).
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
    /** The leaving slot's fade ended: it draws nothing until the next trace. */
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

/**
 * One family-colored band per ribbon, under the zoom's scale `x` (none for a
 * ribbon more than `reach` px off the plot): the trace's bridges and ribbons,
 * and Comfortable's resting ribbons.
 */
export function ribbonPaths(
  model: ChartModel,
  ribbons: readonly Ribbon[],
  x: (offset: number) => number,
  plotWidth: number,
  reach: number,
): ReactNode[] {
  return ribbons.map((ribbon) => {
    const d = ribbonPath(
      model.spec,
      model.layout,
      model.frame,
      ribbon,
      x,
      plotWidth,
      reach,
    );
    return d ? (
      <path key={ribbonKey(ribbon)} d={d} fill={familyColor(ribbon.family)} />
    ) : null;
  });
}

interface RingProps {
  model: ChartModel;
  at: FeatureRef;
  x: (offset: number) => number;
  strokeWidth: number;
  className: string;
}

/** A ring just outside a glyph: the pinned gene's, or the hovered one's. */
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
  /** A gene of the traced family. */
  at: FeatureRef;
  x: (offset: number) => number;
  plotWidth: number;
  reach: number;
  measure: TextMeasure;
}

/**
 * One family's trace: every ribbon of the family (plus bridges over the
 * genomes without it), and its glyphs on top.
 */
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

/**
 * The card-colored veil over the track while a family is traced, which the
 * trace is drawn over. It covers the plot, so it stays put while a drag
 * slides the trace (`PannedLayers`).
 */
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
  /** How far past the plot's edges the trace is drawn, px: 0 at rest, `panReach` while a drag pans. */
  reach: number;
  measure: TextMeasure;
}

/**
 * The family trace over the veil (`TraceVeil`): the family's trace in one of
 * two slots (the last family's fading out in the other), and the pin and
 * hover rings. Never a pointer target, so hovering still reaches the glyphs
 * below.
 */
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
          // The slot stays put while its trace changes, so its opacity fades.
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
          // A new gene's ring fades in rather than jumping there.
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

/**
 * While a family is traced (the hovered gene's, else the pinned one's): rows
 * without it fade, rows with it get a family-colored edge. Both marks stay
 * drawn on every row, transparent while unused, so they fade in and out.
 */
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
