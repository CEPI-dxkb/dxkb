"use client";

/**
 * The Compare Region Viewer's track layers under the glyphs and around them:
 * row bands, contig baselines, the resting ribbons, the focus line and the
 * bp ruler, plus Compact's hovered-row tint. All but the tint take only the
 * model and the zoom, so a hover redraws none of them; the tint reads the
 * hovered row from `RowHoverContext`.
 */
import { use } from "react";
import { familyColor, focusFamilyColor } from "@/lib/compare-region/colors";
import { rulerHeight } from "@/lib/compare-region/density";
import type { ChartModel } from "@/lib/compare-region/families";
import type { FigureFrame } from "@/lib/compare-region/figure-frame";
import { isOffPlot } from "@/lib/compare-region/glyph-placement";
import {
  connectorAlpha,
  connectorFade,
  connectorPath,
  restingRibbons,
  ribbonAlpha,
  ribbonKey,
} from "@/lib/compare-region/ribbons";
import {
  focusLineX,
  rulerTicks,
  trackScale,
  type TrackMatrix,
} from "@/lib/compare-region/ruler";
import { ribbonPaths, RowHoverContext } from "./compare-region-highlight";

interface LayerProps {
  model: ChartModel;
  matrix: TrackMatrix;
  plotWidth: number;
}

interface ReachingLayerProps extends LayerProps {
  /** How far past the plot's edges to draw, px: 0 at rest, `panReach` while a drag pans. */
  reach: number;
}

/**
 * Resting ribbons for the neighbor families most genomes share, reaching
 * rarer families and firming up a little as the zoom grows. Comfortable draws
 * faint bands; Compact draws one 1.25 px center line per pair (faded when it
 * runs far sideways), so dense rows stay line work, not a wash of color.
 */
export function RibbonLayer({
  model,
  matrix,
  plotWidth,
  reach,
}: ReachingLayerProps) {
  const { spec } = model;
  const x = trackScale(model.layout.domain, matrix, plotWidth);
  // The focus family needs none: its genes already stack on the focus line.
  const shown = restingRibbons(model, matrix.scaleX);
  if (spec.restingRibbons === "connectors") {
    const alpha = connectorAlpha(matrix.scaleX);
    return (
      <g
        pointerEvents="none"
        fill="none"
        strokeWidth={1.25}
        strokeLinecap="round"
      >
        {shown.map((ribbon) => {
          const connector = connectorPath(
            spec,
            model.layout,
            model.frame,
            ribbon,
            x,
            plotWidth,
            reach,
          );
          if (!connector) return null;
          return (
            <path
              key={ribbonKey(ribbon)}
              d={connector.d}
              stroke={familyColor(ribbon.family)}
              strokeOpacity={
                Math.round(alpha * connectorFade(connector.reach) * 100) / 100
              }
            />
          );
        })}
      </g>
    );
  }
  return (
    <g pointerEvents="none" fillOpacity={ribbonAlpha(matrix.scaleX)}>
      {ribbonPaths(model, shown, x, plotWidth, reach)}
    </g>
  );
}

/** Each row's contig line through its genes, with a tick where the contig ends. */
export function Baselines({ model, matrix, plotWidth }: LayerProps) {
  const x = trackScale(model.layout.domain, matrix, plotWidth);
  const tick = model.spec.contigTick;
  return (
    <g className="stroke-muted-foreground/40" pointerEvents="none">
      {model.layout.rows.map((placed, rowIndex) => {
        const y = model.frame.rows[rowIndex].center;
        const from = x(placed.baselineFrom);
        const to = x(placed.baselineTo);
        return (
          <g key={`${placed.row.genomeId}:${String(rowIndex)}`}>
            <line x1={from} x2={to} y1={y} y2={y} />
            {placed.contigStartShown && (
              <line
                x1={from}
                x2={from}
                y1={y - tick}
                y2={y + tick}
                strokeWidth={1.5}
              />
            )}
            {placed.contigEndShown && (
              <line
                x1={to}
                x2={to}
                y1={y - tick}
                y2={y + tick}
                strokeWidth={1.5}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

/**
 * Zebra bands, the focus row's wash and the hairlines between rows, from `x`
 * across `width`. The wash is the focus genes' orange (a data color) at 5%
 * (4% in dark themes), so it follows them in every theme.
 */
export function RowBands({
  frame,
  x,
  width,
}: {
  frame: FigureFrame;
  x: number;
  width: number;
}) {
  return (
    <g pointerEvents="none">
      {frame.rows.map((row, index) =>
        index === 0 ? (
          <rect
            key={index}
            x={x}
            y={row.slotTop}
            width={width}
            height={row.slotBottom - row.slotTop}
            fill={focusFamilyColor}
            className="opacity-5 dark:opacity-4"
          />
        ) : index % 2 === 1 ? (
          <rect
            key={index}
            x={x}
            y={row.slotTop}
            width={width}
            height={row.slotBottom - row.slotTop}
            className="fill-muted/50 dark:fill-muted/35"
          />
        ) : null,
      )}
      <g className="stroke-border" shapeRendering="crispEdges">
        {frame.dividers.map((y) => (
          <line key={y} x1={x} x2={x + width} y1={y} y2={y} />
        ))}
      </g>
    </g>
  );
}

/** The row bands across the track (the label column draws its own). */
export function TrackBands({
  frame,
  plotWidth,
}: {
  frame: FigureFrame;
  plotWidth: number;
}) {
  return <RowBands frame={frame} x={0} width={plotWidth} />;
}

/**
 * Compact only: the hovered row's band, tinted. Drawn twice, under the
 * track's glyphs and under the label column's text (there with a thin edge
 * at the left), so one row reads straight across a long list.
 */
export function RowTint({
  frame,
  x,
  width,
  edge = false,
}: {
  frame: FigureFrame;
  x: number;
  width: number;
  edge?: boolean;
}) {
  const row = use(RowHoverContext);
  const slot = row === null ? undefined : frame.rows.at(row);
  if (!slot) return null;
  const height = slot.slotBottom - slot.slotTop;
  return (
    <g data-overlay="" pointerEvents="none">
      <rect
        x={x}
        y={slot.slotTop}
        width={width}
        height={height}
        className="fill-primary/10 dark:fill-foreground/8"
      />
      {edge && (
        <rect
          x={x}
          y={slot.slotTop}
          width={2}
          height={height}
          className="fill-primary/70 dark:fill-link/80"
        />
      )}
    </g>
  );
}

/**
 * The dashed line at offset 0, where every row's pinned gene ends. It is the
 * focus family's own orange (a data color), so it always matches the focus
 * genes, whatever the theme.
 */
export function FocusLine({
  model,
  matrix,
  plotWidth,
  reach,
}: ReachingLayerProps) {
  const x0 = focusLineX(model.layout.domain, matrix, plotWidth);
  if (isOffPlot(x0, x0, plotWidth, 2 + reach)) return null;
  return (
    <line
      x1={x0}
      x2={x0}
      y1={rulerHeight - 4}
      y2={model.frame.height - 6}
      stroke={focusFamilyColor}
      strokeWidth={1.25}
      strokeDasharray="4 3"
      pointerEvents="none"
    />
  );
}

/** The ruler's tick labels, px (mono). */
const rulerLabelSize = 11;

/** The bp ruler, from the focus gene, following the zoom. Labels within 20 px of an edge hide. */
export function RulerAxis({ model, matrix, plotWidth }: LayerProps) {
  const { major, minor } = rulerTicks(model.layout.domain, matrix, plotWidth);
  const axisY = rulerHeight - 6;
  return (
    <g pointerEvents="none">
      <rect width={plotWidth} height={rulerHeight} className="fill-card" />
      <line
        x1={0}
        x2={plotWidth}
        y1={axisY}
        y2={axisY}
        className="stroke-border"
      />
      <g className="stroke-muted-foreground/35">
        {minor.map((tick) => (
          <line key={tick} x1={tick} x2={tick} y1={axisY} y2={axisY - 3} />
        ))}
      </g>
      {major.map((tick) => (
        <g
          key={tick.offset}
          className={
            tick.x < 20 || tick.x > plotWidth - 20 ? "hidden" : undefined
          }
        >
          <line
            x1={tick.x}
            x2={tick.x}
            y1={axisY}
            y2={axisY - 6}
            className="stroke-muted-foreground/70"
          />
          {tick.offset === 0 ? (
            <text
              x={tick.x}
              y={axisY - 9}
              textAnchor="middle"
              fontSize={rulerLabelSize}
              className="fill-foreground font-mono font-semibold"
            >
              0
            </text>
          ) : (
            <text
              x={tick.x}
              y={axisY - 9}
              textAnchor="middle"
              fontSize={rulerLabelSize}
              className="fill-foreground/70 font-mono"
            >
              {tick.label}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}
