"use client";

import { numberFormatter } from "@/lib/services/organisms/utils";

import { geoNoDataFill, type GeoColorScale } from "./color-scale";

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumSignificantDigits: 3,
});

interface ColorLegendProps {
  scale: GeoColorScale;
  /** What a region's count is: "Genomes per state". */
  unit: string;
}

/** Each step's full range, for screen readers: "5,200 to 7,999". */
function describeSteps({ steps, max }: GeoColorScale): string {
  return steps
    .map((step, index) => {
      const next = steps.at(index + 1);
      const to = next ? next.from - 1 : max;
      return to > step.from
        ? `${numberFormatter.format(step.from)} to ${numberFormatter.format(to)}`
        : numberFormatter.format(step.from);
    })
    .join("; ");
}

/** The map's color steps as a stepped bar, with boundary labels in a row below and a leading "No data" swatch. */
export function ColorLegend({ scale, unit }: ColorLegendProps) {
  const { steps, max } = scale;
  const lastStep = steps.at(-1);
  const starts = steps.map((step) => step.from);
  const bounds = lastStep && max > lastStep.from ? [...starts, max] : starts;
  const ranges = describeSteps(scale);

  return (
    <div
      role="img"
      aria-label={`${unit}: ${ranges ? `${ranges}. ` : ""}No data: no genomes.`}
      // Text sits 1px up so the 12px text centers on the 10px swatches alone.
      className="flex flex-wrap items-start gap-x-5 gap-y-3 text-xs text-muted-foreground"
    >
      <span className="-mt-px leading-none">{unit}</span>
      <div className="flex gap-2">
        <div className="flex flex-col items-center gap-1.5">
          <span
            className="h-2.5 w-10 rounded-sm"
            style={{ background: geoNoDataFill }}
          />
          <span className="h-4 whitespace-nowrap">No data</span>
        </div>
        {steps.length > 0 && (
          <div className="flex flex-col gap-1.5 px-4">
            <div className="flex">
              {steps.map((step) => (
                <span
                  key={step.from}
                  className="h-2.5 w-10 first:rounded-l-sm last:rounded-r-sm"
                  style={{ background: step.fill }}
                />
              ))}
            </div>
            <div className="relative h-4">
              {bounds.map((bound, index) => (
                <span
                  key={bound}
                  className="absolute top-0 -translate-x-1/2 whitespace-nowrap tabular-nums"
                  style={{ left: `${String((index / steps.length) * 100)}%` }}
                >
                  {compactFormatter.format(bound)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
