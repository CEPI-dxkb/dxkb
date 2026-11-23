"use client";

import { Fragment, type ReactNode } from "react";

import { useHiddenOverviewCharts } from "@/hooks/views/use-hidden-overview-charts";
import type { OverviewChartViewType } from "@/lib/overview-charts";

interface ChartVisibilityGridProps {
  /** Leave out to show every chart, as the organism landings do. */
  viewType?: OverviewChartViewType;
  items: { id: string; node: ReactNode }[];
}

/** The chart grid of a Metadata Distributions section, without the charts the user hid. The cookie seeds the provider on the server, so the first paint already omits them. */
export function ChartVisibilityGrid({
  viewType,
  items,
}: ChartVisibilityGridProps) {
  const { hidden } = useHiddenOverviewCharts(viewType);
  return (
    <div className="grid grid-cols-1 gap-3 @[640px]:grid-cols-2 @[1080px]:grid-cols-3 @[1600px]:grid-cols-4">
      {items
        .filter((item) => !hidden.includes(item.id))
        .map((item) => (
          <Fragment key={item.id}>{item.node}</Fragment>
        ))}
    </div>
  );
}
