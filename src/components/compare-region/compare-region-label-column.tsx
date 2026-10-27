"use client";

/**
 * The Compare Region Viewer's genome column: each row's number tag, genome
 * name and identity to the focus gene, on an opaque card so the track can
 * scroll under it, and its header over the ruler. Comfortable sets the
 * species over the strain; Compact fits both on one line. It takes only the
 * model, so a hover redraws none of it. The focus row's tag, accent, wash
 * and "focus" text are in the focus genes' orange (a data color, as an
 * attribute), not the theme's secondary color, so they match the genes in
 * every theme; dark themes set the "focus" text in the foreground color (a
 * class, which beats the attribute).
 */
import type { ReactNode } from "react";
import {
  focusFamilyColor,
  identityColor,
  labelInk,
} from "@/lib/compare-region/colors";
import { rulerHeight, type DensitySpec } from "@/lib/compare-region/density";
import type { ChartModel } from "@/lib/compare-region/families";
import type { RowFrame } from "@/lib/compare-region/figure-frame";
import {
  oneLineGenomeName,
  oneLineSpeciesSize,
  oneLineStrainGap,
  oneLineStrainSize,
  rowIdentity,
  rowTagText,
  splitGenomeName,
} from "@/lib/compare-region/genome-labels";
import { fitText, type TextMeasure } from "@/lib/compare-region/labels";
import type { PlacedRow } from "@/lib/compare-region/layout";
import { RowBands } from "./compare-region-track-layers";

interface RowLabelProps {
  spec: DensitySpec;
  placed: PlacedRow;
  rowFrame: RowFrame;
  rowIndex: number;
  identity: number | null;
  labelWidth: number;
  measure: TextMeasure;
}

/**
 * The row number's tag; the focus row's is in the focus family's orange (a
 * data color, so it matches the focus genes in every theme), inked like a
 * label on a family fill.
 */
function RowTag({
  spec,
  center,
  rowIndex,
}: {
  spec: DensitySpec;
  center: number;
  rowIndex: number;
}) {
  const focus = rowIndex === 0;
  return (
    <>
      <rect
        x={spec.tagX}
        y={center - spec.tagHeight / 2}
        width={spec.tagWidth}
        height={spec.tagHeight}
        rx={spec.tagRadius}
        fill={focus ? focusFamilyColor : undefined}
        className={
          focus ? undefined : "fill-muted dark:fill-muted-foreground/15"
        }
      />
      <text
        x={spec.tagX + spec.tagWidth / 2}
        y={center + spec.tagBaseline}
        textAnchor="middle"
        fontSize={spec.tagFontSize}
        fill={focus ? labelInk : undefined}
        className={
          focus ? "font-mono font-semibold" : "fill-muted-foreground font-mono"
        }
      >
        {rowTagText(rowIndex)}
      </text>
    </>
  );
}

/** Comfortable's identity column: a dot and "70%" (the dot drops in a column under 230 px). */
const identityWidth = 46;
const narrowIdentityWidth = 34;
/** The identity dot's center, from the column's right edge. */
const identityDotInset = 44;
/** Comfortable's species and strain, px; measured and drawn in these sizes. */
const twoLineSpeciesSize = 12;
const twoLineStrainSize = 10.5;
const twoLineSpeciesFont = `italic 500 ${String(twoLineSpeciesSize)}px`;
const twoLineStrainFont = `${String(twoLineStrainSize)}px`;

/** Comfortable: the species in italics over the strain, then the identity dot and percentage. */
function TwoLineLabel({
  spec,
  placed,
  rowFrame,
  rowIndex,
  identity,
  labelWidth,
  measure,
}: RowLabelProps) {
  const center = rowFrame.center;
  const focus = rowIndex === 0;
  const { nameX, endPad } = spec;
  const name = splitGenomeName(placed.row.genomeName);
  const narrow = labelWidth < 230;
  const room =
    labelWidth - nameX - (narrow ? narrowIdentityWidth : identityWidth) - 4;
  const binomial = fitText(name.binomial, room, twoLineSpeciesFont, measure);
  const rest = fitText(name.rest, room, twoLineStrainFont, measure);
  return (
    <g>
      <title>{`${String(rowIndex + 1)}. ${placed.row.genomeName}`}</title>
      <RowTag spec={spec} center={center} rowIndex={rowIndex} />
      <text
        x={nameX}
        y={name.rest ? center - 1.5 : center + 4}
        fontSize={twoLineSpeciesSize}
        className="fill-foreground font-medium italic"
      >
        {binomial}
      </text>
      {name.rest && (
        <text
          x={nameX}
          y={center + 11}
          fontSize={twoLineStrainSize}
          className="fill-muted-foreground"
        >
          {rest}
        </text>
      )}
      {focus ? (
        <text
          x={labelWidth - endPad}
          y={center + 3.5}
          textAnchor="end"
          fontSize={9.5}
          fill={focusFamilyColor}
          className="font-semibold tracking-wide uppercase dark:fill-foreground"
        >
          focus
        </text>
      ) : (
        identity !== null && (
          <>
            {!narrow && (
              <circle
                cx={labelWidth - identityDotInset}
                cy={center}
                r={3.5}
                fill={identityColor(identity)}
              />
            )}
            <text
              x={labelWidth - endPad}
              y={center + 3.5}
              textAnchor="end"
              fontSize={10}
              className="fill-muted-foreground font-mono"
            >
              {`${String(Math.round(identity))}%`}
            </text>
          </>
        )
      )}
    </g>
  );
}

/** Compact's room kept right of the name for "100%" (or the focus row's "FOCUS"), with its gap. */
const compactIdentityWidth = 28;
const compactFocusWidth = 36;

/** Compact: species and strain on one line, centered on the gene, and a compact mono "70%". */
function OneLineLabel({
  spec,
  placed,
  rowFrame,
  rowIndex,
  identity,
  labelWidth,
  measure,
}: RowLabelProps) {
  const center = rowFrame.center;
  const focus = rowIndex === 0;
  const { nameX, endPad } = spec;
  const room =
    labelWidth -
    nameX -
    (focus ? compactFocusWidth : compactIdentityWidth) -
    endPad;
  const { binomial, rest } = oneLineGenomeName(
    placed.row.genomeName,
    room,
    measure,
  );
  return (
    <g>
      <title>{`${String(rowIndex + 1)}. ${placed.row.genomeName}`}</title>
      <RowTag spec={spec} center={center} rowIndex={rowIndex} />
      <text x={nameX} y={center + 3.8} fontSize={oneLineSpeciesSize}>
        <tspan className="fill-foreground font-medium italic">{binomial}</tspan>
        {rest && (
          <tspan
            dx={oneLineStrainGap}
            fontSize={oneLineStrainSize}
            className="fill-muted-foreground"
          >
            {rest}
          </tspan>
        )}
      </text>
      {focus ? (
        <text
          x={labelWidth - endPad}
          y={center + 3.2}
          textAnchor="end"
          fontSize={8.5}
          fill={focusFamilyColor}
          className="font-semibold tracking-wide uppercase dark:fill-foreground"
        >
          focus
        </text>
      ) : (
        identity !== null && (
          <text
            x={labelWidth - endPad}
            y={center + 3.3}
            textAnchor="end"
            fontSize={9.5}
            className="fill-muted-foreground font-mono"
          >
            {`${String(Math.round(identity))}%`}
          </text>
        )
      )}
    </g>
  );
}

interface LabelColumnProps {
  model: ChartModel;
  labelWidth: number;
  measure: TextMeasure;
  /** Drawn over the bands and under the text (Compact's row tint). */
  children?: ReactNode;
}

/** Row numbers, genome names and identity, on an opaque card so the track can scroll under it. */
export function LabelColumn({
  model,
  labelWidth,
  measure,
  children,
}: LabelColumnProps) {
  const { frame, layout, spec } = model;
  const focus = frame.rows.at(0);
  const RowLabel = spec.genomeLine === "one-line" ? OneLineLabel : TwoLineLabel;
  return (
    <g>
      <rect width={labelWidth} height={frame.height} className="fill-card" />
      <RowBands frame={frame} x={0} width={labelWidth} />
      {children}
      {/* The focus row's accent, in the focus genes' orange. */}
      {focus && (
        <rect
          x={0}
          y={focus.slotTop}
          width={3}
          height={focus.slotBottom - focus.slotTop}
          fill={focusFamilyColor}
        />
      )}
      <line
        x1={labelWidth - 0.5}
        x2={labelWidth - 0.5}
        y1={0}
        y2={frame.height}
        className="stroke-border"
      />
      {layout.rows.map((placed, rowIndex) => (
        <RowLabel
          key={`${placed.row.genomeId}:${String(rowIndex)}`}
          spec={spec}
          placed={placed}
          rowFrame={frame.rows[rowIndex]}
          rowIndex={rowIndex}
          identity={rowIndex === 0 ? null : rowIdentity(layout, rowIndex)}
          labelWidth={labelWidth}
          measure={measure}
        />
      ))}
    </g>
  );
}

/** The label column's header, over the ruler's band (sticky with it), on the density's columns. */
export function LabelHeader({
  spec,
  labelWidth,
}: {
  spec: DensitySpec;
  labelWidth: number;
}) {
  const headerY = rulerHeight - 11;
  return (
    <g pointerEvents="none">
      <rect width={labelWidth} height={rulerHeight} className="fill-card" />
      <line
        x1={0}
        x2={labelWidth}
        y1={rulerHeight - 6}
        y2={rulerHeight - 6}
        className="stroke-border"
      />
      <line
        x1={labelWidth - 0.5}
        x2={labelWidth - 0.5}
        y1={0}
        y2={rulerHeight}
        className="stroke-border"
      />
      <g
        fontSize={9}
        className="fill-muted-foreground font-medium tracking-wider uppercase"
      >
        <text x={spec.tagX + spec.tagWidth / 2} y={headerY} textAnchor="middle">
          #
        </text>
        <text x={spec.nameX} y={headerY}>
          Genome
        </text>
        <text x={labelWidth - spec.endPad} y={headerY} textAnchor="end">
          Identity
        </text>
      </g>
    </g>
  );
}
