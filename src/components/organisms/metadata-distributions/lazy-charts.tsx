"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * The Overview's metadata charts, one chunk each (SSR on), so only an Overview
 * ships visx and the charts; see docs/architecture.md, "Views & organism
 * landing". Fallbacks use `h-80` (the charts have no fixed height), as
 * `MetadataDistributionsSkeleton` does.
 */
function ChartLoading() {
  return <Skeleton className="h-80 rounded-lg" />;
}

export const LazyBarChart = dynamic(
  () => import("./bar-chart").then((module) => module.BarChart),
  { loading: ChartLoading },
);

export const LazyDonutChart = dynamic(
  () => import("./donut-chart").then((module) => module.DonutChart),
  { loading: ChartLoading },
);

export const LazyAmrBarStackChart = dynamic(
  () =>
    import("./amr-bar-stack-chart").then((module) => module.AmrBarStackChart),
  { loading: ChartLoading },
);
