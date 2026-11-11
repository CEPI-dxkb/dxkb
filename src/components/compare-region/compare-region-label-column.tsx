"use client";

/**
 * Text is foreground at 70%, not `muted-foreground`, which fell to about 4:1 on
 * the light themes' row bands at these sizes.
 */
import { Info } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  focusFamilyColor,
  focusInk,
  labelInk,
} from "@/lib/compare-region/colors";
import { rulerHeight, type DensitySpec } from "@/lib/compare-region/density";
import type { ChartModel } from "@/lib/compare-region/families";
import type { RowFrame } from "@/lib/compare-region/figure-frame";
import {
  centeredBaseline,
  genomeLabelLines,
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
        y={centeredBaseline(center, spec.tagFontSize)}
        textAnchor="middle"
        fontSize={spec.tagFontSize}
        fill={focus ? labelInk : undefined}
        className={
          focus ? "font-mono font-semibold" : "fill-foreground/70 font-mono"
        }
      >
        {rowTagText(rowIndex)}
      </text>
    </>
  );
}

function RowLabel({
  spec,
  placed,
  rowFrame,
  rowIndex,
  identity,
  labelWidth,
  measure,
}: RowLabelProps) {
  const focus = rowIndex === 0;
  const { nameX, endPad } = spec;
  const name = splitGenomeName(placed.row.genomeName);
  const lines = genomeLabelLines(spec, rowFrame, Boolean(name.rest));
  const room =
    labelWidth -
    nameX -
    (focus ? spec.focusRoom : spec.identityRoom) -
    endPad;
  const binomial = fitText(name.binomial, room, speciesFont(spec), measure);
  const rest = fitText(name.rest, room, strainFont(spec), measure);
  return (
    <g>
      <title>{`${String(rowIndex + 1)}. ${placed.row.genomeName}`}</title>
      <RowTag spec={spec} center={lines.middle} rowIndex={rowIndex} />
      <text
        x={nameX}
        y={lines.speciesBaseline}
        fontSize={spec.speciesSize}
        className="fill-foreground font-medium italic"
      >
        {binomial}
      </text>
      {name.rest && (
        <text
          x={nameX}
          y={lines.strainBaseline}
          fontSize={spec.strainSize}
          className="fill-foreground/70"
        >
          {rest}
        </text>
      )}
      {focus ? (
        <text
          x={labelWidth - endPad}
          y={centeredBaseline(lines.middle, spec.focusSize)}
          textAnchor="end"
          fontSize={spec.focusSize}
          fill={focusInk}
          className="font-semibold tracking-wide uppercase dark:fill-foreground"
        >
          focus
        </text>
      ) : (
        identity !== null && (
          <text
            x={labelWidth - endPad}
            y={centeredBaseline(lines.middle, spec.identitySize)}
            textAnchor="end"
            fontSize={spec.identitySize}
            className="fill-foreground/70 font-mono"
          >
            {`${String(Math.round(identity))}%`}
          </text>
        )
      )}
    </g>
  );
}

function speciesFont(spec: DensitySpec): string {
  return `italic 500 ${String(spec.speciesSize)}px`;
}

function strainFont(spec: DensitySpec): string {
  return `${String(spec.strainSize)}px`;
}

interface LabelColumnProps {
  model: ChartModel;
  labelWidth: number;
  measure: TextMeasure;
  children?: ReactNode;
}

export function LabelColumn({
  model,
  labelWidth,
  measure,
  children,
}: LabelColumnProps) {
  const { frame, layout, spec } = model;
  const focus = frame.rows.at(0);
  return (
    <g>
      <rect width={labelWidth} height={frame.height} className="fill-card" />
      <RowBands frame={frame} x={0} width={labelWidth} />
      {children}
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

const headerFontSize = 10;
const headerFont = `500 ${String(headerFontSize)}px`;
const headerTracking = 0.05 * headerFontSize;
const identityHeading = "IDENTITY";
const headerRule = rulerHeight - 6;
const headerMiddle = headerRule / 2;

export function LabelHeader({
  spec,
  labelWidth,
}: {
  spec: DensitySpec;
  labelWidth: number;
}) {
  const headerY = centeredBaseline(headerMiddle, headerFontSize);
  return (
    <g pointerEvents="none">
      <rect width={labelWidth} height={rulerHeight} className="fill-card" />
      <line
        x1={0}
        x2={labelWidth}
        y1={headerRule}
        y2={headerRule}
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
        fontSize={headerFontSize}
        className="fill-foreground/70 font-medium tracking-wider uppercase"
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

/** HTML laid over the header's corner, so the figure's SVG and an export of it carry none of it. */
export function IdentityInfo({
  spec,
  labelWidth,
  measure,
}: {
  spec: DensitySpec;
  labelWidth: number;
  measure: TextMeasure;
}) {
  const wordLeft =
    labelWidth -
    spec.endPad -
    measure(identityHeading, headerFont) -
    identityHeading.length * headerTracking;
  const left = wordLeft - 21;
  return (
    <div
      className="absolute top-0.5 left-(--identity-info-x) z-10 flex text-foreground/70"
      style={{ "--identity-info-x": `${String(left)}px` } as CSSProperties}
    >
      <Popover>
        <PopoverTrigger
          openOnHover
          delay={150}
          render={
            <Button
              type="button"
              variant="ghost-accent"
              size="icon-2xs"
              aria-label="About identity"
            />
          }
        >
          <Info />
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start">
          <PopoverHeader>
            <PopoverTitle>Identity</PopoverTitle>
            <PopoverDescription>
              How closely the gene each row is aligned on matches the focus
              gene: the share of positions that are identical where BLAST
              aligns the two. 100% is an exact match, and lower means the gene
              has diverged further. The focus row holds the focus gene itself.
            </PopoverDescription>
          </PopoverHeader>
        </PopoverContent>
      </Popover>
    </div>
  );
}
