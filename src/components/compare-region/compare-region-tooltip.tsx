"use client";

/**
 * The Compare Region Viewer's hover tooltip: the hovered feature's ID,
 * product, location, family (and how many genomes share it), identity to the
 * focus gene and genome. It hangs just below and right of the gene, not from
 * the pointer (`placeFeaturePopupElement`). Place it outside the figure's
 * scroller, so the scroller's overflow does not clip it. A click pins it as
 * the feature card (`compare-region-feature-card.tsx`), which opens with the
 * same lines in the same place.
 */
import type { ReactNode, Ref } from "react";
import {
  familyReach,
  isLoner,
  resolveFeature,
  type ChartModel,
  type FeatureRef,
} from "@/lib/compare-region/families";
import {
  formatLocation,
  noProduct,
  rowTagText,
} from "@/lib/compare-region/genome-labels";
import { cn } from "@/lib/utils";
import { FeatureSwatch } from "./compare-region-glyphs";

/** The tooltip's popover look, which the pinned card shares. */
export const featureTooltipSurface =
  "rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-lg";

interface FeatureLinesProps {
  model: ChartModel;
  at: FeatureRef;
  /** Buttons at the end of the ID line (the pinned card's Collapse/Expand and Close). */
  actions?: ReactNode;
}

/** The tooltip's lines for `at`: ID, product, location, family, identity and genome. */
export function FeatureLines({ model, at, actions }: FeatureLinesProps) {
  const resolved = resolveFeature(model.layout, at);
  if (!resolved) return null;
  const { row, feature } = resolved;
  const reach = familyReach(model.families, feature, model.layout.rows.length);
  return (
    <>
      <div className="flex items-center gap-2">
        <FeatureSwatch
          spec={model.spec}
          feature={feature}
          faded={isLoner(model.families, feature)}
        />
        <span className="truncate font-mono text-2xs text-muted-foreground">
          {feature.fid}
        </span>
        {actions}
      </div>
      <p className="mt-1.5 text-sm leading-snug font-medium">
        {feature.product || noProduct}
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">Location</dt>
        <dd className="font-mono text-2xs leading-4">
          {formatLocation(feature)}
        </dd>
        {feature.familyId && (
          <>
            <dt className="text-muted-foreground">Family</dt>
            <dd>
              <span className="font-mono text-2xs">{feature.familyId}</span>
              {reach && (
                <span className="text-muted-foreground">{` · ${reach}`}</span>
              )}
            </dd>
          </>
        )}
        {feature.identity !== null && (
          <>
            <dt className="text-muted-foreground">Identity</dt>
            <dd>{`${String(feature.identity)}% to the focus gene`}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Genome</dt>
        <dd>
          <span className="font-mono text-2xs text-muted-foreground">
            {`${rowTagText(at.rowIndex)} `}
          </span>
          {row.genomeName}
        </dd>
      </dl>
    </>
  );
}

interface CompareRegionTooltipProps {
  model: ChartModel;
  /** The hovered feature; nothing shows while it is undefined. */
  at: FeatureRef | undefined;
  /** The chart's, to place the tooltip: it starts hidden (`data-offscreen`) until placed. */
  ref: Ref<HTMLDivElement>;
}

export function CompareRegionTooltip({
  model,
  at,
  ref,
}: CompareRegionTooltipProps) {
  if (!at || !resolveFeature(model.layout, at)) return null;
  return (
    <div
      // Each gene's tooltip is its own, which fades in where it opens
      // (`starting:`) rather than jumping there from the last gene's.
      key={`${String(at.rowIndex)}:${String(at.featureIndex)}`}
      ref={ref}
      data-feature-tooltip=""
      data-offscreen=""
      className={cn(
        "pointer-events-none absolute top-0 left-0 z-20 w-80 max-w-(--popup-max-w) translate-x-(--popup-x) translate-y-(--popup-y) transition-opacity duration-100 ease-out data-offscreen:invisible starting:opacity-0",
        featureTooltipSurface,
      )}
    >
      <FeatureLines model={model} at={at} />
    </div>
  );
}
