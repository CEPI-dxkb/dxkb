"use client";

import { deepen, featurePaint, labelInk } from "@/lib/compare-region/colors";
import type { CompareRegionFeature } from "@/lib/compare-region/contract";
import type { DensitySpec } from "@/lib/compare-region/density";
import {
  isLoner,
  type ChartModel,
  type FamilyIndex,
  type FeatureRef,
} from "@/lib/compare-region/families";
import {
  glyphKind,
  type GlyphKind,
  type RowFrame,
} from "@/lib/compare-region/figure-frame";
import { glyphPath } from "@/lib/compare-region/glyph-paths";
import { placeGlyph } from "@/lib/compare-region/glyph-placement";
import { featureName, rowName } from "@/lib/compare-region/keyboard";
import type { GlyphLabel, TextMeasure } from "@/lib/compare-region/labels";
import type { PlacedRow } from "@/lib/compare-region/layout";
import { trackScale, type TrackMatrix } from "@/lib/compare-region/ruler";
import { cn } from "@/lib/utils";

interface GlyphOutlineProps {
  spec: DensitySpec;
  kind: GlyphKind;
  d: string;
  fill: string | undefined;
  pinned: boolean;
  faded: boolean;
  rowIndex?: number;
  featureIndex?: number;
  name?: string;
  tabStop?: boolean;
}

function GlyphOutline({
  spec,
  kind,
  d,
  fill,
  pinned,
  faded,
  rowIndex,
  featureIndex,
  name,
  tabStop = false,
}: GlyphOutlineProps) {
  const data =
    rowIndex === undefined
      ? {}
      : {
          "data-row": rowIndex,
          "data-feature": featureIndex,
          role: "button",
          "aria-label": name,
          tabIndex: tabStop ? 0 : -1,
        };
  // The trace's veil would cover the browser's outline.
  const target = rowIndex === undefined ? undefined : "outline-none";
  if (kind === "blast") {
    return <path d={d} fill={fill} className={target} {...data} />;
  }
  if (kind === "other") {
    return (
      <path
        d={d}
        className={cn("fill-muted-foreground/40", target)}
        {...data}
      />
    );
  }
  if (kind === "orphan") {
    return (
      <path
        d={d}
        className={cn(
          pinned
            ? "fill-muted-foreground/30 stroke-foreground/60"
            : "fill-muted-foreground/20 stroke-card dark:fill-muted-foreground/25",
          target,
        )}
        strokeWidth={pinned ? 1.25 : 1}
        {...data}
      />
    );
  }
  if (kind === "pseudo") {
    return fill ? (
      <path
        d={d}
        fill={fill}
        fillOpacity={0.25}
        className={cn("stroke-foreground/55", target)}
        strokeDasharray={spec.pseudoDash}
        {...data}
      />
    ) : (
      <path
        d={d}
        className={cn("fill-muted-foreground/10 stroke-foreground/55", target)}
        strokeDasharray={spec.pseudoDash}
        {...data}
      />
    );
  }
  if (pinned) {
    return (
      <path
        d={d}
        fill={fill}
        stroke={fill ? deepen(fill) : undefined}
        strokeWidth={spec.pinnedStroke}
        className={target}
        {...data}
      />
    );
  }
  return (
    <path
      d={d}
      fill={fill}
      className={cn(
        faded ? "stroke-card opacity-45 dark:opacity-35" : "stroke-card",
        target,
      )}
      strokeWidth={1}
      {...data}
    />
  );
}

/**
 * On a fill a quiet label keeps the full ink, since any lighter falls under
 * 4.5:1 on the darker families.
 */
function LabelText({
  label,
  onFill,
  size,
}: {
  label: GlyphLabel;
  onFill: boolean;
  size: number;
}) {
  const shared = {
    x: label.x,
    y: label.y,
    fontSize: size,
    textAnchor: "middle" as const,
    pointerEvents: "none" as const,
    "aria-hidden": true,
  };
  if (onFill) {
    return (
      <text
        {...shared}
        fill={labelInk}
        className={label.quiet ? "font-medium italic" : "font-medium"}
      >
        {label.text}
      </text>
    );
  }
  return (
    <text
      {...shared}
      className={
        label.quiet
          ? "fill-foreground/85 font-medium italic"
          : "fill-foreground font-medium"
      }
    >
      {label.text}
    </text>
  );
}

interface GlyphMarkProps extends GlyphOutlineProps {
  label?: GlyphLabel | null;
}

export function GlyphMark(props: GlyphMarkProps) {
  const { spec, kind, faded, label } = props;
  return (
    <>
      <GlyphOutline {...props} />
      {label && (
        <LabelText
          label={label}
          onFill={kind === "gene" && !faded}
          size={spec.labelSize}
        />
      )}
    </>
  );
}

interface GlyphRowProps {
  spec: DensitySpec;
  placed: PlacedRow;
  rowFrame: RowFrame;
  rowIndex: number;
  x: (offset: number) => number;
  plotWidth: number;
  reach: number;
  pressedFeature: number | null;
  stopFeature: number | null;
  families: FamilyIndex;
  measure: TextMeasure;
}

function GlyphRow({
  spec,
  placed,
  rowFrame,
  rowIndex,
  x,
  plotWidth,
  reach,
  pressedFeature,
  stopFeature,
  families,
  measure,
}: GlyphRowProps) {
  const pinnedFid = placed.row.pinnedFid;
  return (
    <g role="group" aria-label={rowName(rowIndex, placed.row.genomeName)}>
      {placed.features.map((item, featureIndex) => {
        // Never the glyph a drag pressed (it holds the pointer's capture) nor
        // the tab stop (keyboard focus must reach it).
        const kept =
          featureIndex === pressedFeature || featureIndex === stopFeature;
        const glyph = placeGlyph(
          spec,
          rowFrame,
          item,
          x,
          plotWidth,
          measure,
          kept ? Infinity : reach,
        );
        if (!glyph) return null;
        return (
          <GlyphMark
            key={`${item.feature.fid}:${String(featureIndex)}`}
            spec={spec}
            kind={glyph.kind}
            d={glyph.d}
            fill={featurePaint(item.feature)}
            pinned={item.feature.fid === pinnedFid}
            faded={isLoner(families, item.feature)}
            label={glyph.label}
            rowIndex={rowIndex}
            featureIndex={featureIndex}
            name={featureName(item.feature)}
            tabStop={featureIndex === stopFeature}
          />
        );
      })}
    </g>
  );
}

interface GlyphLayerProps {
  model: ChartModel;
  matrix: TrackMatrix;
  plotWidth: number;
  reach: number;
  pressed: FeatureRef | null;
  tabStop?: FeatureRef | null;
  measure: TextMeasure;
}

export function GlyphLayer({
  model,
  matrix,
  plotWidth,
  reach,
  pressed,
  tabStop = null,
  measure,
}: GlyphLayerProps) {
  const x = trackScale(model.layout.domain, matrix, plotWidth);
  return (
    <g>
      {model.layout.rows.map((placed, rowIndex) => (
        <GlyphRow
          key={`${placed.row.genomeId}:${String(rowIndex)}`}
          spec={model.spec}
          placed={placed}
          rowFrame={model.frame.rows[rowIndex]}
          rowIndex={rowIndex}
          x={x}
          plotWidth={plotWidth}
          reach={reach}
          pressedFeature={
            pressed?.rowIndex === rowIndex ? pressed.featureIndex : null
          }
          stopFeature={
            tabStop?.rowIndex === rowIndex ? tabStop.featureIndex : null
          }
          families={model.families}
          measure={measure}
        />
      ))}
    </g>
  );
}

export function FeatureSwatch({
  spec,
  feature,
  faded,
}: {
  spec: DensitySpec;
  feature: CompareRegionFeature;
  faded: boolean;
}) {
  const kind = glyphKind(feature);
  const [top, bottom] =
    kind === "blast"
      ? spec.swatchBlast
      : kind === "other"
        ? spec.swatchOther
        : [0, spec.swatchHeight];
  const forward = feature.strand !== "-";
  return (
    <svg
      width={28}
      height={spec.swatchHeight}
      aria-hidden
      className="shrink-0 overflow-visible"
    >
      <GlyphOutline
        spec={spec}
        kind={kind}
        d={glyphPath(
          spec,
          kind,
          forward ? 1 : 27,
          forward ? 27 : 1,
          top,
          bottom,
        )}
        fill={featurePaint(feature)}
        pinned={false}
        faded={faded}
      />
    </svg>
  );
}
