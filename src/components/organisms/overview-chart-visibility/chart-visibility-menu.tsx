"use client";

import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useHiddenOverviewCharts } from "@/hooks/views/use-hidden-overview-charts";
import {
  overviewChartViewTypeScopes,
  type OverviewChartViewType,
} from "@/lib/overview-charts";

interface ChartVisibilityMenuProps {
  viewType: OverviewChartViewType;
  charts: { id: string; title: string }[];
}

/** Which of this overview's charts show. Remembered per view type on this device. */
export function ChartVisibilityMenu({
  viewType,
  charts,
}: ChartVisibilityMenuProps) {
  const { hidden, setChartHidden, showAll } = useHiddenOverviewCharts(viewType);
  const shownCount = charts.filter((chart) => !hidden.includes(chart.id)).length;
  const customised = shownCount < charts.length;
  const counts = `${String(shownCount)}/${String(charts.length)}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="toolbar"
            aria-label={`Charts ${counts} shown${customised ? ", customised" : ""}`}
          />
        }
      >
        <SlidersHorizontal />
        <span>Charts</span>{" "}
        <span className="text-muted-foreground tabular-nums">{counts}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {`Show charts for ${overviewChartViewTypeScopes[viewType]}`}
          </DropdownMenuLabel>
          {charts.map((chart) => {
            const checked = !hidden.includes(chart.id);
            return (
              <DropdownMenuCheckboxItem
                key={chart.id}
                checked={checked}
                // The last visible chart stays: an empty section is nothing to show.
                disabled={checked && shownCount === 1}
                onCheckedChange={(next) => {
                  setChartHidden(chart.id, !next);
                }}
              >
                {chart.title}
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!customised} onClick={showAll}>
          Show all charts
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
