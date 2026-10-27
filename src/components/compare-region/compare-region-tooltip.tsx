"use client";

/**
 * The Compare Region Viewer's hover tooltip: the hovered feature's ID,
 * product, location, family (and how many genomes share it), identity to the
 * focus gene and genome. Place it outside the figure's scroller, so the
 * scroller's overflow does not clip it.
 */
import { TooltipWithBounds } from "@visx/tooltip";
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
import { FeatureSwatch } from "./compare-region-glyphs";

interface CompareRegionTooltipProps {
  model: ChartModel;
  /** The hovered feature; nothing shows while it is undefined. */
  at: FeatureRef | undefined;
  /** In the chart root's coordinates (`useChartPointer`'s `tooltipLeft`/`tooltipTop`). */
  left: number | undefined;
  top: number | undefined;
}

export function CompareRegionTooltip({
  model,
  at,
  left,
  top,
}: CompareRegionTooltipProps) {
  const hovered = resolveFeature(model.layout, at);
  if (!hovered || !at) return null;
  const { row, feature } = hovered;
  const reach = familyReach(model.families, feature, model.layout.rows.length);
  return (
    <TooltipWithBounds
      left={left}
      top={top}
      unstyled
      className="pointer-events-none absolute z-20 w-80 rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-lg"
    >
      <div className="flex items-center gap-2">
        <FeatureSwatch
          spec={model.spec}
          feature={feature}
          faded={isLoner(model.families, feature)}
        />
        <span className="truncate font-mono text-2xs text-muted-foreground">
          {feature.fid}
        </span>
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
    </TooltipWithBounds>
  );
}
