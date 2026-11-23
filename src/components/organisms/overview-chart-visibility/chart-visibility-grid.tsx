"use client";

import { Fragment, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useHiddenOverviewCharts } from "@/hooks/views/use-hidden-overview-charts";
import type { OverviewChartViewType } from "@/lib/overview-charts";

interface ChartVisibilityGridProps {
  /** Leave out to show every chart, as the organism landings do. */
  viewType?: OverviewChartViewType;
  items: { id: string; node: ReactNode }[];
}

/** The chart grid of a Metadata Distributions section, without the charts the user hid. The cookie seeds the provider on the server, so the first paint already omits them. Hidden ids are shared by every page of a view type, so a page can have all of its charts hidden (the AMR chart is on bacterial pages only); it then says so and offers them back instead of showing a blank grid. */
export function ChartVisibilityGrid({
  viewType,
  items,
}: ChartVisibilityGridProps) {
  const { hidden, showAll } = useHiddenOverviewCharts(viewType);
  const visible = items.filter((item) => !hidden.includes(item.id));

  if (items.length > 0 && visible.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">
          All charts are hidden for this view.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={showAll}>
          Show all charts
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 @[640px]:grid-cols-2 @[1080px]:grid-cols-3 @[1600px]:grid-cols-4">
      {visible.map((item) => (
        <Fragment key={item.id}>{item.node}</Fragment>
      ))}
    </div>
  );
}
