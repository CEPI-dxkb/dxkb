"use client";

/**
 * The Compare Region Viewer's family trace. The hovered (else the pinned)
 * gene's family is redrawn over a veil across the track, and the label
 * column marks the rows that hold it. The hovered gene reaches these
 * overlays through `HoverContext` and the pinned one through `PinContext`,
 * and Compact's hovered row reaches its tint through `RowHoverContext`, so
 * the layers under them never re-render on a hover (and what reads only the
 * pin, such as the selection strip, does not either). Every overlay is marked
 * `data-overlay`, which the export drops.
 */
import { createContext, use, type ReactNode } from "react";
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
 * One family-colored band per ribbon, under the zoom's scale `x` (none for a
 * ribbon with nothing on screen): the trace's bridges and ribbons, and
 * Comfortable's resting ribbons.
 */
export function ribbonPaths(
  model: ChartModel,
  ribbons: readonly Ribbon[],
  x: (offset: number) => number,
  plotWidth: number,
): ReactNode[] {
  return ribbons.map((ribbon) => {
    const d = ribbonPath(
      model.spec,
      model.layout,
      model.frame,
      ribbon,
      x,
      plotWidth,
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

interface HighlightLayerProps {
  model: ChartModel;
  matrix: TrackMatrix;
  plotWidth: number;
  measure: TextMeasure;
}

/**
 * The family trace over the track: a card-colored veil, then every ribbon
 * of the family (plus bridges over the genomes without it) and its glyphs on
 * top, and the pin and hover rings. Never a pointer target, so hovering
 * still reaches the glyphs below.
 */
export function HighlightLayer({
  model,
  matrix,
  plotWidth,
  measure,
}: HighlightLayerProps) {
  const { hovered, selected, focus } = useTraceFocus();
  const members = focusMembers(model, focus);
  const x = trackScale(model.layout.domain, matrix, plotWidth);
  const family =
    members.length > 0
      ? (resolveFeature(model.layout, focus)?.feature.family ?? null)
      : null;
  const ribbons =
    family === null ? [] : (model.families.ribbonsByFamily.get(family) ?? []);
  const bridges =
    family === null ? [] : bridgeRibbons(model.layout, model.families, family);
  const { frame, spec } = model;
  return (
    <g pointerEvents="none" data-overlay="">
      <rect
        x={0}
        y={rulerHeight}
        width={plotWidth}
        height={frame.height - rulerHeight}
        className={
          members.length > 0
            ? "fill-card opacity-80 transition-opacity duration-150"
            : "fill-card opacity-0 transition-opacity duration-150"
        }
      />
      {bridges.length > 0 && (
        <g className="opacity-25">
          {ribbonPaths(model, bridges, x, plotWidth)}
        </g>
      )}
      {family !== null && (
        <g className="opacity-55 dark:opacity-50">
          {ribbonPaths(model, ribbons, x, plotWidth)}
        </g>
      )}
      {members.map((ref) => {
        const placed = model.layout.rows.at(ref.rowIndex);
        const item = placed?.features.at(ref.featureIndex);
        const rowFrame = frame.rows.at(ref.rowIndex);
        if (!placed || !item || !rowFrame) return null;
        const glyph = placeGlyph(spec, rowFrame, item, x, plotWidth, measure);
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
          model={model}
          at={hovered}
          x={x}
          strokeWidth={1.25}
          className="stroke-foreground/70"
        />
      )}
    </g>
  );
}

/**
 * While a family is traced (the hovered gene's, else the pinned one's): rows
 * without it fade, rows with it get a family-colored edge.
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
  if (members.length === 0) return null;
  const target = resolveFeature(model.layout, focus);
  const color = target ? featurePaint(target.feature) : undefined;
  const rowsWith = new Set(members.map((ref) => ref.rowIndex));
  return (
    <g pointerEvents="none" data-overlay="">
      {model.frame.rows.map((rowFrame, rowIndex) =>
        rowsWith.has(rowIndex) ? (
          <rect
            key={rowIndex}
            x={0}
            y={rowFrame.slotTop}
            width={3}
            height={rowFrame.slotBottom - rowFrame.slotTop}
            fill={color}
            className={color ? undefined : "fill-muted-foreground"}
          />
        ) : (
          <rect
            key={rowIndex}
            x={0}
            y={rowFrame.slotTop}
            width={labelWidth - 1}
            height={rowFrame.slotBottom - rowFrame.slotTop}
            className="fill-card opacity-70"
          />
        ),
      )}
    </g>
  );
}
