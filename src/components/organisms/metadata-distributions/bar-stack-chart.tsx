"use client";

import { useRef, useState } from "react";

import { Group } from "@visx/group";
import { scaleBand, scaleLinear, scaleOrdinal } from "@visx/scale";
import { BarStack } from "@visx/shape";
import { useTooltip } from "@visx/tooltip";

import { Card, CardContent } from "@/components/ui/card";
import type {
  SerotypeDistributionData,
  SerotypeYear,
} from "@/lib/services/organisms/types";
import {
  chartColors,
  chartTooltipStyle,
} from "@/lib/services/organisms/chart-utils";
import { numberFormatter } from "@/lib/services/organisms/utils";

import { ChartLegendPill } from "./_shared/chart-legend-pill";
import { ChartStatusMessage, EmptyChart } from "./_shared/chart-status-message";
import {
  chartMarginLeft,
  chartMarginTop,
  chartWidth,
  stackedChartHeight,
  stackedInnerHeight,
  yearInnerWidth,
} from "./_shared/chart-dimensions";
import { useStackedChartHighlight } from "./_shared/use-stacked-chart-highlight";
import { nearestBandIndex } from "./_shared/use-svg-band-pointer";
import { YAxisTicks } from "./_shared/y-axis-ticks";

interface ColumnTooltipRow {
  serovar: string;
  count: number;
  color: string;
}

interface ColumnTooltipData {
  year: number;
  rows: ColumnTooltipRow[];
}

interface BarStackChartProps {
  title: string;
  data: SerotypeDistributionData;
  errorMessage?: string;
}

const tooltipOffsetX = 16;
const tooltipOffsetY = 16;

export function BarStackChart({
  title,
  data,
  errorMessage,
}: BarStackChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const highlight = useStackedChartHighlight();
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);
  const { showTooltip, hideTooltip, tooltipData, tooltipLeft, tooltipTop } =
    useTooltip<ColumnTooltipData>();

  if (errorMessage || data.years.length === 0) {
    return (
      <Card variant="panel" className="relative" size="sm">
        <CardContent className="flex flex-1 flex-col">
          <h3 className="m-0 text-sm font-semibold">{title}</h3>
          {errorMessage ? (
            <ChartStatusMessage errorMessage={errorMessage} />
          ) : (
            <EmptyChart title={title} />
          )}
        </CardContent>
      </Card>
    );
  }

  const activeIdx = highlight.activeIdx;

  const xScale = scaleBand<number>({
    domain: data.years.map((y) => y.year),
    range: [0, yearInnerWidth],
    padding: 0.25,
  });

  const yMax = Math.max(
    ...data.years.map((y) =>
      data.serovars.reduce((sum, sv) => sum + (y[sv] ?? 0), 0),
    ),
    1,
  );

  const yScale = scaleLinear<number>({
    domain: [0, yMax],
    range: [stackedInnerHeight, 0],
    nice: true,
  });

  const colorScale = scaleOrdinal<string, string>({
    domain: data.serovars,
    range: chartColors.slice(0, data.serovars.length),
  });

  const yTicks = yScale.ticks(4);

  return (
    <Card variant="panel" className="relative" size="sm">
      <CardContent className="flex flex-1 flex-col">
        <h3 className="m-0 text-sm font-semibold">{title}</h3>
        <div className="min-w-0 overflow-hidden pt-2">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${String(chartWidth)} ${String(stackedChartHeight)}`}
            role="img"
            aria-label={`${title} distribution`}
            className="w-full"
          >
            <Group left={chartMarginLeft} top={chartMarginTop}>
              <YAxisTicks
                ticks={yTicks}
                yScale={yScale}
                innerWidth={yearInnerWidth}
              />

              {/* X-axis baseline */}
              <line
                x1={0}
                x2={yearInnerWidth}
                y1={stackedInnerHeight}
                y2={stackedInnerHeight}
                stroke="var(--border)"
                strokeWidth={1}
              />

              {/* Column hover highlight — rendered behind the bars */}
              {hoveredYear !== null && (
                <rect
                  x={(xScale(hoveredYear) ?? 0) - xScale.step() * 0.125}
                  y={0}
                  width={xScale.step()}
                  height={stackedInnerHeight}
                  fill="var(--primary)"
                  fillOpacity={0.08}
                  rx={3}
                  pointerEvents="none"
                />
              )}

              {/* Stacked bars — pointer-events handled by overlay below */}
              <BarStack<SerotypeYear, string>
                data={data.years}
                keys={data.serovars}
                x={(d) => d.year}
                xScale={xScale}
                yScale={yScale}
                color={colorScale}
              >
                {(barStacks) =>
                  barStacks.map((barStack) => {
                    const svIdx = barStack.index;
                    const isActive = activeIdx === svIdx;
                    const isDimmed = activeIdx !== null && !isActive;

                    return barStack.bars.map((bar) => {
                      const count = bar.bar.data[barStack.key] ?? 0;
                      const label = `${barStack.key}: ${numberFormatter.format(count)}`;
                      return (
                        <rect
                          key={`bar-${String(barStack.index)}-${String(bar.index)}`}
                          x={bar.x}
                          y={bar.y}
                          height={Math.max(bar.height, 0)}
                          width={bar.width}
                          fill={bar.color}
                          rx={barStack.index === barStacks.length - 1 ? 2 : 0}
                          // SVG <rect> has no implicit ARIA role; graphics-symbol permits
                          // aria-label without tripping axe aria-prohibited-attr on WebKit/Firefox.
                          role="graphics-symbol"
                          aria-label={label}
                          pointerEvents="none"
                          style={{
                            opacity: isDimmed ? 0.12 : 1,
                            transition: "opacity 160ms ease",
                          }}
                        >
                          <title>{label}</title>
                        </rect>
                      );
                    });
                  })
                }
              </BarStack>

              {/*
               * Transparent overlay — covers the full inner chart area.
               * Detects mouse position to determine the nearest year column,
               * then shows the column highlight and tooltip for the whole area
               * (not just where bars exist). Click locks/unlocks a serovar.
               */}
              <rect
                data-testid="chart-overlay"
                x={0}
                y={0}
                width={yearInnerWidth}
                height={stackedInnerHeight}
                fill="transparent"
                onMouseMove={(event) => {
                  const idx = nearestBandIndex(
                    event,
                    svgRef,
                    xScale,
                    data.years.map((y) => y.year),
                  );
                  if (idx === null) return;
                  const yearEntry = data.years[idx];
                  setHoveredYear(yearEntry.year);
                  showTooltip({
                    tooltipData: {
                      year: yearEntry.year,
                      rows: data.serovars
                        .reduce<ColumnTooltipRow[]>((rows, serovar) => {
                          const count = yearEntry[serovar] ?? 0;
                          if (count > 0) {
                            rows.push({
                              serovar,
                              count,
                              color: colorScale(serovar),
                            });
                          }
                          return rows;
                        }, [])
                        .sort((a, b) => b.count - a.count),
                    },
                    tooltipLeft: event.clientX,
                    tooltipTop: event.clientY,
                  });
                }}
                onMouseLeave={() => {
                  setHoveredYear(null);
                  hideTooltip();
                }}
                onClick={() => {
                  // Click in empty space releases any serovar lock
                  highlight.clearHighlight();
                }}
              />

              {/* X-axis year labels */}
              {data.years.map((d) => {
                const x = (xScale(d.year) ?? 0) + xScale.bandwidth() / 2;
                return (
                  <text
                    key={`xlabel-${String(d.year)}`}
                    x={x}
                    y={stackedInnerHeight + 18}
                    textAnchor="middle"
                    fontSize={11}
                    className="fill-muted-foreground tabular-nums"
                  >
                    {d.year}
                  </text>
                );
              })}
            </Group>
          </svg>
        </div>

        {/* Legend pills */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {data.serovars.map((sv, idx) => {
            const isActive = activeIdx === idx;
            const isDimmed = activeIdx !== null && !isActive;
            return (
              <ChartLegendPill
                key={sv}
                label={sv}
                color={colorScale(sv)}
                active={isActive}
                dimmed={isDimmed}
                ariaPressed={highlight.pressedFor(idx)}
                onActivate={() => {
                  highlight.activatePill(idx);
                }}
                onDeactivate={highlight.deactivatePill}
                onClick={() => {
                  highlight.togglePillLock(idx);
                }}
              />
            );
          })}
        </div>
      </CardContent>

      {/* Tooltip — shows all serovars for the hovered year */}
      {tooltipData && (
        <div
          role="status"
          className="pointer-events-none fixed z-50 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
          style={chartTooltipStyle(
            tooltipLeft ?? 0,
            tooltipTop ?? 0,
            160,
            20 + tooltipData.rows.length * 22,
            tooltipOffsetX,
            tooltipOffsetY,
          )}
        >
          <p className="mb-1.5 font-semibold text-foreground">
            {tooltipData.year}
          </p>
          <div className="flex flex-col gap-1">
            {tooltipData.rows.map(({ serovar, count, color }) => (
              <div key={serovar} className="flex items-center gap-2">
                <span
                  className="inline-block size-2 shrink-0 rounded-full"
                  style={{ background: color }}
                />
                <span className="flex-1 text-muted-foreground">{serovar}</span>
                <span className="font-semibold tabular-nums">
                  {numberFormatter.format(count)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
