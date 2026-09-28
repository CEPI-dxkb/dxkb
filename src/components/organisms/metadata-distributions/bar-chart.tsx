"use client";

import { useRef } from "react";

import { Group } from "@visx/group";
import { scaleBand, scaleLinear } from "@visx/scale";
import { useTooltip } from "@visx/tooltip";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { chartTooltipStyle } from "@/lib/services/organisms/chart-utils";
import { numberFormatter } from "@/lib/services/organisms/utils";

import {
  chartMarginLeft,
  chartMarginTop,
  chartWidth,
  yearChartHeight,
  yearInnerHeight,
  yearInnerWidth,
} from "./_shared/chart-dimensions";
import { ChartStatusMessage, EmptyChart } from "./_shared/chart-status-message";
import { nearestBandIndex } from "./_shared/use-svg-band-pointer";
import { YAxisTicks } from "./_shared/y-axis-ticks";
import { labelStep, parseYearData, type YearDatum } from "./_shared/year-data";

interface BarChartProps {
  title: string;
  data: { label: string; value: number }[];
  errorMessage?: string;
}

export function BarChart({
  title,
  data,
  errorMessage,
}: BarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const yearData = parseYearData(data);
  const { showTooltip, hideTooltip, tooltipData, tooltipLeft, tooltipTop } =
    useTooltip<YearDatum>();

  const xScale = scaleBand<number>({
    domain: yearData.map((d) => d.year),
    range: [0, yearInnerWidth],
    padding: 0.25,
  });

  const maxCount = Math.max(...yearData.map((d) => d.count), 1);
  const yScale = scaleLinear<number>({
    domain: [0, maxCount],
    range: [yearInnerHeight, 0],
    nice: true,
  });

  const yTicks = yScale.ticks(4);
  const step = labelStep(yearData.length);

  return (
    <Card variant="panel" className="relative" size="sm">
      <CardHeader>
        <h3 className="m-0 text-sm font-semibold">{title}</h3>
      </CardHeader>
      <CardContent>
        {errorMessage ? (
          <ChartStatusMessage errorMessage={errorMessage} />
        ) : yearData.length === 0 ? (
          <EmptyChart title={title} />
        ) : (
          <div className="min-w-0 overflow-hidden">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${String(chartWidth)} ${String(yearChartHeight)}`}
              role="group"
              aria-label={`${title} distribution`}
              className="w-full"
            >
              <Group left={chartMarginLeft} top={chartMarginTop}>
                <YAxisTicks ticks={yTicks} yScale={yScale} innerWidth={yearInnerWidth} />

                {yearData.map((d) => {
                  const barX = xScale(d.year) ?? 0;
                  const barWidth = xScale.bandwidth();
                  const barY = yScale(d.count);
                  const barHeight = yearInnerHeight - barY;
                  const label = `${String(d.year)}: ${numberFormatter.format(d.count)}`;

                  return (
                    <rect
                      key={d.year}
                      x={barX}
                      y={barY}
                      width={barWidth}
                      height={barHeight}
                      fill="var(--chart-1)"
                      rx={2}
                      tabIndex={0}
                      // SVG <rect> has no implicit ARIA role; graphics-symbol permits
                      // aria-label without tripping axe aria-prohibited-attr on WebKit/Firefox.
                      role="graphics-symbol"
                      aria-label={label}
                      onFocus={(event) => {
                        const rect =
                          event.currentTarget.getBoundingClientRect();
                        showTooltip({
                          tooltipData: d,
                          tooltipLeft: rect.left + rect.width / 2,
                          tooltipTop: rect.top + rect.height / 2,
                        });
                      }}
                      onBlur={hideTooltip}
                    >
                      <title>{label}</title>
                    </rect>
                  );
                })}

                {yearData.map((d, i) => {
                  if (i % step !== 0) return null;
                  const labelX = (xScale(d.year) ?? 0) + xScale.bandwidth() / 2;
                  return (
                    <text
                      key={`label-${String(d.year)}`}
                      x={labelX}
                      y={yearInnerHeight + 12}
                      textAnchor="middle"
                      dominantBaseline="hanging"
                      fontSize={11}
                      className="fill-muted-foreground tabular-nums"
                    >
                      {d.year}
                    </text>
                  );
                })}

                <line
                  x1={0}
                  x2={yearInnerWidth}
                  y1={yearInnerHeight}
                  y2={yearInnerHeight}
                  stroke="var(--border)"
                  strokeWidth={1}
                />

                {tooltipData && (
                  <rect
                    x={(xScale(tooltipData.year) ?? 0) - xScale.step() * 0.125}
                    y={0}
                    width={xScale.step()}
                    height={yearInnerHeight}
                    fill="var(--primary)"
                    fillOpacity={0.12}
                    rx={3}
                    pointerEvents="none"
                  />
                )}

                <rect
                  data-testid="chart-overlay"
                  x={0}
                  y={0}
                  width={yearInnerWidth}
                  height={yearInnerHeight}
                  fill="transparent"
                  onMouseMove={(event) => {
                    const idx = nearestBandIndex(event, svgRef, xScale, yearData.map((d) => d.year));
                    const d = idx !== null ? yearData[idx] : undefined;
                    if (d) {
                      showTooltip({
                        tooltipData: d,
                        tooltipLeft: event.clientX,
                        tooltipTop: event.clientY,
                      });
                    }
                  }}
                  onMouseLeave={hideTooltip}
                />
              </Group>
            </svg>
          </div>
        )}
      </CardContent>
      {tooltipData && (
        <div
          role="status"
          className="pointer-events-none fixed z-50 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
          style={chartTooltipStyle(tooltipLeft ?? 0, tooltipTop ?? 0, 150, 28)}
        >
          {tooltipData.year}: {numberFormatter.format(tooltipData.count)}
        </div>
      )}
    </Card>
  );
}
