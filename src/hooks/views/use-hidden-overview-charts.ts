"use client";

import {
  withChartHidden,
  type OverviewChartViewType,
} from "@/lib/overview-charts";
import { useUiPreference } from "@/lib/ui-preferences/provider";

const noHiddenCharts: readonly string[] = [];

/** The charts hidden on one overview, read and written through the `overviewHiddenCharts` cookie. A missing view type (the organism landings) hides nothing and writes nothing. */
export function useHiddenOverviewCharts(
  viewType: OverviewChartViewType | undefined,
) {
  const [allHidden, setAllHidden] = useUiPreference("overviewHiddenCharts");
  const hidden = viewType ? allHidden[viewType] : noHiddenCharts;

  function update(change: (current: readonly string[]) => readonly string[]) {
    if (!viewType) return;
    setAllHidden((previous) => {
      const current = previous[viewType];
      const next = change(current);
      return next === current ? previous : { ...previous, [viewType]: next };
    });
  }

  return {
    hidden,
    setChartHidden: (id: string, hide: boolean) => {
      update((current) => withChartHidden(current, id, hide));
    },
    showAll: () => {
      update((current) => (current.length === 0 ? current : []));
    },
  };
}
