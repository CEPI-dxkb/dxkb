"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

import { animate } from "framer-motion";

import { scaleOrdinal } from "@visx/scale";
import { useTooltip } from "@visx/tooltip";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { facetDisplayLabel } from "@/components/organisms/facet-label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  chartColors as sharedChartColors,
  chartTooltipStyle,
  donutFallbackColor,
} from "@/lib/services/organisms/chart-utils";
import { numberFormatter } from "@/lib/services/organisms/utils";

import { ChartLegendPill } from "./_shared/chart-legend-pill";
import { ChartStatusMessage } from "./_shared/chart-status-message";

export interface DonutDatum {
  label: string;
  value: number;
}

interface DonutChartDatum extends DonutDatum {
  id: string;
}

export interface DonutChartTab {
  label: string;
  data: DonutDatum[];
}

interface DonutChartProps {
  title: string;
  data?: DonutDatum[];
  tabs?: DonutChartTab[];
  layout?: "bottom" | "side";
  errorMessage?: string;
}

// Donut uses up to 10 distinct accents plus a muted color for the "Others" bucket.
// chart-1..5 are brand-derived per theme (primary/secondary/accent/violet/coral);
// chart-6..10 are shared fills from globals.css.
// Sequence (dxkb): navy(267)→amber(37)→teal(195)→coral(15)→gold(85)→pink(340)→green(140)→violet(310)→orange(50)→cyan-green(175)→gray
const donutPalette = [
  sharedChartColors[0], // chart-1:  primary      h≈267
  sharedChartColors[1], // chart-2:  secondary    h≈37
  sharedChartColors[5], // chart-6:  teal         h=195
  sharedChartColors[4], // chart-5:  coral        h≈15
  sharedChartColors[2], // chart-3:  gold         h≈85
  sharedChartColors[8], // chart-9:  pink         h=340
  sharedChartColors[7], // chart-8:  green        h=140
  sharedChartColors[3], // chart-4:  violet       h≈310
  sharedChartColors[6], // chart-7:  orange       h=50
  sharedChartColors[9], // chart-10: cyan-green   h=175
  donutFallbackColor,
];

const chartSize = 160;
const chartCenter = chartSize / 2;
const outerRadius = 66;
const innerRadius = 38;
const popDistance = 8;
const tooltipEstimatedWidth = 160;
const tooltipEstimatedHeight = 32;
const aggregateLabel = "Others";
const fallbackAggregateLabel = "Other values";

function uniqueAggregateLabel(labels: readonly string[]): string {
  const existingLabels = new Set(labels);
  if (!existingLabels.has(aggregateLabel)) return aggregateLabel;
  if (!existingLabels.has(fallbackAggregateLabel))
    return fallbackAggregateLabel;
  let suffix = 2;
  while (existingLabels.has(`${fallbackAggregateLabel} ${String(suffix)}`)) {
    suffix += 1;
  }
  return `${fallbackAggregateLabel} ${String(suffix)}`;
}

function chartData(data: DonutDatum[]): DonutChartDatum[] {
  const positive: DonutChartDatum[] = [];
  data.forEach((datum, index) => {
    if (datum.value > 0) {
      positive.push({
        ...datum,
        id: `bucket-${String(index)}`,
        label: facetDisplayLabel(datum.label),
      });
    }
  });

  if (positive.length <= 10) return positive;

  const top = positive.slice(0, 9);
  const otherValue = positive
    .slice(9)
    .reduce((sum, datum) => sum + datum.value, 0);

  return [
    ...top,
    {
      id: "aggregate-other",
      label: uniqueAggregateLabel(top.map((datum) => datum.label)),
      value: otherValue,
    },
  ];
}

// Standard donut arc path. Paths are centered at (0,0); the parent <g> handles
// translation to the chart center.
function arcPath(
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = endAngle - startAngle;
  const f = (n: number) => Math.round(n * 1000) / 1000;

  // Full-circle slice (single positive datum): SVG arc with identical start/end
  // points renders nothing. Build the ring as two semicircles using even-odd fill.
  if (sweep >= Math.PI * 2 - 1e-6) {
    return [
      `M ${String(f(outerR))} 0`,
      `A ${String(outerR)} ${String(outerR)} 0 1 1 ${String(f(-outerR))} 0`,
      `A ${String(outerR)} ${String(outerR)} 0 1 1 ${String(f(outerR))} 0`,
      "Z",
      `M ${String(f(innerR))} 0`,
      `A ${String(innerR)} ${String(innerR)} 0 1 0 ${String(f(-innerR))} 0`,
      `A ${String(innerR)} ${String(innerR)} 0 1 0 ${String(f(innerR))} 0`,
      "Z",
    ].join(" ");
  }

  const pt = (radius: number, angle: number) => ({
    x: radius * Math.sin(angle),
    y: -radius * Math.cos(angle),
  });

  const outerStart = pt(outerR, startAngle);
  const outerEnd = pt(outerR, endAngle);
  const innerEnd = pt(innerR, endAngle);
  const innerStart = pt(innerR, startAngle);

  const large = sweep > Math.PI ? 1 : 0;
  const p = ({ x, y }: { x: number; y: number }) =>
    `${String(f(x))} ${String(f(y))}`;

  return [
    `M ${p(outerStart)}`,
    `A ${String(outerR)} ${String(outerR)} 0 ${String(large)} 1 ${p(outerEnd)}`,
    `L ${p(innerEnd)}`,
    `A ${String(innerR)} ${String(innerR)} 0 ${String(large)} 0 ${p(innerStart)}`,
    "Z",
  ].join(" ");
}

interface ArcDatum {
  slice: DonutChartDatum;
  startAngle: number;
  endAngle: number;
  pathD: string;
  popX: number;
  popY: number;
  color: string;
}

function buildArcData(
  slices: DonutChartDatum[],
  getColor: (id: string) => string,
): ArcDatum[] {
  const total = slices.reduce((sum, d) => sum + d.value, 0);
  let angle = -Math.PI / 2;

  return slices.map((slice) => {
    const full = (slice.value / total) * Math.PI * 2;
    const startAngle = angle;
    const endAngle = angle + full;
    const midAngle = (startAngle + endAngle) / 2;
    angle += full;

    return {
      slice,
      startAngle,
      endAngle,
      pathD: arcPath(innerRadius, outerRadius, startAngle, endAngle),
      popX: Math.sin(midAngle) * popDistance,
      popY: -Math.cos(midAngle) * popDistance,
      color: getColor(slice.id),
    };
  });
}

interface AnimatedArcDatum extends ArcDatum {
  opacity: number;
}

function interpolateArcData(
  prev: AnimatedArcDatum[],
  target: ArcDatum[],
  t: number,
): AnimatedArcDatum[] {
  const result: AnimatedArcDatum[] = [];
  const previousById = new Map(prev.map((arc) => [arc.slice.id, arc]));
  const targetIds = new Set(target.map((arc) => arc.slice.id));
  for (const toArc of target) {
    const fromArc = previousById.get(toArc.slice.id);
    if (fromArc) {
      const s =
        fromArc.startAngle + (toArc.startAngle - fromArc.startAngle) * t;
      const e = fromArc.endAngle + (toArc.endAngle - fromArc.endAngle) * t;
      result.push({
        ...toArc,
        startAngle: s,
        endAngle: e,
        pathD:
          e - s > 0.001 ? arcPath(innerRadius, outerRadius, s, e) : "M 0 0",
        opacity: 1,
      });
    } else {
      const mid = (toArc.startAngle + toArc.endAngle) / 2;
      const s = mid + (toArc.startAngle - mid) * t;
      const e = mid + (toArc.endAngle - mid) * t;
      result.push({
        ...toArc,
        startAngle: s,
        endAngle: e,
        pathD:
          e - s > 0.001 ? arcPath(innerRadius, outerRadius, s, e) : "M 0 0",
        opacity: t,
      });
    }
  }
  for (const fromArc of prev) {
    if (!targetIds.has(fromArc.slice.id)) {
      const mid = (fromArc.startAngle + fromArc.endAngle) / 2;
      const s = fromArc.startAngle + (mid - fromArc.startAngle) * t;
      const e = fromArc.endAngle + (mid - fromArc.endAngle) * t;
      result.push({
        ...fromArc,
        startAngle: s,
        endAngle: e,
        pathD:
          e - s > 0.001 ? arcPath(innerRadius, outerRadius, s, e) : "M 0 0",
        opacity: 1 - t,
      });
    }
  }
  return result;
}

interface ArcInterp {
  id: string;
  fromStart: number;
  toStart: number;
  fromEnd: number;
  toEnd: number;
  fromOpacity: number;
  toOpacity: number;
}

function buildInterpData(
  prev: AnimatedArcDatum[],
  target: ArcDatum[],
): ArcInterp[] {
  const result: ArcInterp[] = [];
  const previousById = new Map(prev.map((arc) => [arc.slice.id, arc]));
  const targetIds = new Set(target.map((arc) => arc.slice.id));
  for (const toArc of target) {
    const toArcId = toArc.slice.id;
    const fromArc = previousById.get(toArcId);
    if (fromArc) {
      result.push({
        id: toArcId,
        fromStart: fromArc.startAngle,
        toStart: toArc.startAngle,
        fromEnd: fromArc.endAngle,
        toEnd: toArc.endAngle,
        fromOpacity: fromArc.opacity,
        toOpacity: 1,
      });
    } else {
      const mid = (toArc.startAngle + toArc.endAngle) / 2;
      result.push({
        id: toArcId,
        fromStart: mid,
        toStart: toArc.startAngle,
        fromEnd: mid,
        toEnd: toArc.endAngle,
        fromOpacity: 0,
        toOpacity: 1,
      });
    }
  }
  for (const fromArc of prev) {
    if (!targetIds.has(fromArc.slice.id)) {
      const mid = (fromArc.startAngle + fromArc.endAngle) / 2;
      result.push({
        id: fromArc.slice.id,
        fromStart: fromArc.startAngle,
        toStart: mid,
        fromEnd: fromArc.endAngle,
        toEnd: mid,
        fromOpacity: fromArc.opacity,
        toOpacity: 0,
      });
    }
  }
  return result;
}

function legendTooltipAnchor(arc: ArcDatum, rect: DOMRect) {
  const uniformScale = Math.min(
    rect.width / chartSize,
    rect.height / chartSize,
  );
  const letterboxX = (rect.width - chartSize * uniformScale) / 2;
  const letterboxY = (rect.height - chartSize * uniformScale) / 2;
  const midAngle = (arc.startAngle + arc.endAngle) / 2;
  const anchorRadius = Math.cos(midAngle) > 0 ? outerRadius : innerRadius;
  const svgX = Math.sin(midAngle) * anchorRadius + chartCenter + arc.popX;
  const svgY = -Math.cos(midAngle) * anchorRadius + chartCenter + arc.popY;
  const clientX = rect.left + letterboxX + svgX * uniformScale;
  const clientY = rect.top + letterboxY + svgY * uniformScale;
  const halfTooltipWidth = tooltipEstimatedWidth / 2;
  const clampedX = Math.max(
    rect.left + halfTooltipWidth,
    Math.min(clientX, rect.right - halfTooltipWidth),
  );

  return {
    left: clampedX,
    top: clientY,
    caretOffset: clientX - clampedX,
  };
}

function DonutChartTabs({
  tabs,
  activeIndex,
  onChange,
}: {
  tabs: DonutChartTab[];
  activeIndex: number;
  onChange: (index: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const check = () => {
      setCanScrollLeft(element.scrollLeft > 0);
      setCanScrollRight(
        element.scrollLeft + element.clientWidth < element.scrollWidth - 1,
      );
    };
    check();
    element.addEventListener("scroll", check);
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(check);
      observer.observe(element);
      return () => {
        observer.disconnect();
        element.removeEventListener("scroll", check);
      };
    }
    return () => {
      element.removeEventListener("scroll", check);
    };
  }, [tabs]);

  const scrollable = canScrollLeft || canScrollRight;
  const scrollBy = (delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };
  const scrollButtonClass =
    "transition-[max-width,opacity] duration-300 ease-in-out";

  return (
    <div className="ml-auto flex min-w-0 items-center gap-0.5 rounded-md bg-muted/50 p-0.5">
      <div
        className={cn(
          "shrink-0 overflow-hidden",
          scrollable ? scrollButtonClass : "hidden",
          scrollable &&
            (canScrollLeft ? "max-w-6 opacity-100" : "max-w-0 opacity-0"),
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => {
            scrollBy(-80);
          }}
          aria-label="Scroll tabs left"
        >
          <ChevronLeft className="size-3.5" />
        </Button>
      </div>
      <div
        ref={scrollRef}
        className="flex min-w-0 flex-1 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        <div className="flex flex-nowrap items-center gap-0.5">
          {tabs.map((tab, index) => (
            <Button
              key={tab.label}
              type="button"
              variant={index === activeIndex ? "default" : "ghost"}
              size="xs"
              aria-pressed={index === activeIndex}
              onClick={() => {
                onChange(index);
              }}
              className="shrink-0"
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>
      <div
        className={cn(
          "shrink-0 overflow-hidden",
          scrollable ? scrollButtonClass : "hidden",
          scrollable &&
            (canScrollRight ? "max-w-6 opacity-100" : "max-w-0 opacity-0"),
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => {
            scrollBy(80);
          }}
          aria-label="Scroll tabs right"
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function DonutChartLegend({
  slices,
  colorFor,
  activeId,
  hiddenIds,
  hasData,
  layout,
  onActivate,
  onDeactivate,
  onToggle,
}: {
  slices: DonutChartDatum[];
  colorFor: (id: string) => string;
  activeId: string | null;
  hiddenIds: ReadonlySet<string>;
  hasData: boolean;
  layout: "bottom" | "side";
  onActivate: (id: string) => void;
  onDeactivate: () => void;
  onToggle: (id: string) => void;
}) {
  const isSide = layout === "side";

  return (
    <div
      className={
        isSide
          ? "flex min-w-0 flex-1 flex-col justify-center gap-0.5"
          : "flex flex-wrap justify-center gap-1.5"
      }
      style={{ animation: "donut-legend-up 0.4s 0.4s ease-out both" }}
    >
      {slices.map((slice) => {
        const isHidden = hiddenIds.has(slice.id);
        const activate = hasData
          ? () => {
              onActivate(slice.id);
            }
          : undefined;
        const toggle = hasData
          ? () => {
              onToggle(slice.id);
            }
          : undefined;

        return (
          <ChartLegendPill
            key={slice.id}
            label={slice.label}
            color={colorFor(slice.id)}
            active={activeId === slice.id}
            dimmed={isHidden}
            variant={isSide ? "row" : "pill"}
            ariaPressed={!isHidden}
            ariaLabel={
              !isSide && hasData
                ? `${slice.label}: ${numberFormatter.format(slice.value)}`
                : undefined
            }
            onActivate={activate}
            onDeactivate={hasData ? onDeactivate : undefined}
            onClick={toggle}
          >
            {isSide ? (
              <>
                <span className="min-w-0 flex-1 truncate text-left">
                  {slice.label}
                </span>
                {hasData && (
                  <span className="tabular-nums">
                    {numberFormatter.format(slice.value)}
                  </span>
                )}
              </>
            ) : undefined}
          </ChartLegendPill>
        );
      })}
    </div>
  );
}

function useDonutChart({
  title,
  data,
  tabs,
  layout = "bottom",
  errorMessage,
}: DonutChartProps) {
  const [activeTabIndex, setActiveTabIndex] = useState<number>(0);
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set());

  const activeData: DonutDatum[] = tabs
    ? (tabs[activeTabIndex]?.data ?? [])
    : (data ?? []);
  const dataSlices = chartData(activeData);
  const hasData = dataSlices.length > 0;
  const slices: DonutChartDatum[] = hasData
    ? dataSlices
    : [{ id: "no-data", label: "No data available", value: 1 }];
  const colorScale = scaleOrdinal<string, string>({
    domain: slices.map((datum) => datum.id),
    range: hasData ? donutPalette : ["var(--muted-foreground)"],
  });
  const visibleSlices = slices.filter((slice) => !hiddenIds.has(slice.id));
  const arcData = buildArcData(visibleSlices, (id) => colorScale(id));
  const arcDataKey = visibleSlices
    .map((slice) => `${slice.id}:${String(slice.value)}`)
    .join("|");
  const total = visibleSlices.reduce((sum, d) => sum + d.value, 0);

  const [displayedArcs, setDisplayedArcs] = useState<AnimatedArcDatum[]>([]);
  const prevArcsRef = useRef<AnimatedArcDatum[]>([]);
  const pathRefs = useRef(new Map<string, SVGPathElement>());
  const animRef = useRef<ReturnType<typeof animate> | null>(null);

  const animateToCurrentArcs = useEffectEvent(() => {
    animRef.current?.stop();
    const prev = prevArcsRef.current;
    const target = arcData;
    const interp = buildInterpData(prev, target);
    setDisplayedArcs(interpolateArcData(prev, target, 0));
    let raf2: number;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        animRef.current = animate(0, 1, {
          duration: 0.5,
          ease: [0.22, 1, 0.36, 1],
          onUpdate(t) {
            for (const arc of interp) {
              const el = pathRefs.current.get(arc.id);
              if (!el) continue;
              const s = arc.fromStart + (arc.toStart - arc.fromStart) * t;
              const e = arc.fromEnd + (arc.toEnd - arc.fromEnd) * t;
              el.setAttribute(
                "d",
                e - s > 0.001
                  ? arcPath(innerRadius, outerRadius, s, e)
                  : "M 0 0",
              );
              el.style.opacity = String(
                arc.fromOpacity + (arc.toOpacity - arc.fromOpacity) * t,
              );
            }
          },
          onComplete() {
            const final = target.map((a) => ({ ...a, opacity: 1 }));
            setDisplayedArcs(final);
            prevArcsRef.current = final;
          },
        });
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      animRef.current?.stop();
    };
  });

  useEffect(() => animateToCurrentArcs(), [arcDataKey]);

  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activationSource, setActivationSource] = useState<"cursor" | "legend">(
    "cursor",
  );
  // Horizontal offset (px) of the ▼ caret from the tooltip center.
  // Non-zero only when the tooltip is pushed horizontally to stay within
  // the SVG bounds (prevents overlap with the legend column).
  const [legendCaretOffsetPx, setLegendCaretOffsetPx] = useState(0);
  const activeId = hoveredId;
  const { showTooltip, hideTooltip, tooltipData, tooltipLeft, tooltipTop } =
    useTooltip<DonutDatum & { pct: number }>();

  const handleTabChange = (index: number) => {
    setActiveTabIndex(index);
    setHoveredId(null);
    setHiddenIds(new Set());
    hideTooltip();
  };

  const toggleSlice = (id: string) => {
    hideTooltip();
    const willUnhide = hiddenIds.has(id);
    const next = new Set(hiddenIds);
    if (willUnhide) next.delete(id);
    else next.add(id);
    setHiddenIds(next);
    setHoveredId(willUnhide ? id : null);
  };

  const deactivateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activateHover = (id: string) => {
    if (deactivateTimer.current) {
      clearTimeout(deactivateTimer.current);
      deactivateTimer.current = null;
    }
    setHoveredId(id);
  };

  const deactivate = () => {
    if (deactivateTimer.current) clearTimeout(deactivateTimer.current);
    deactivateTimer.current = setTimeout(() => {
      deactivateTimer.current = null;
      setHoveredId(null);
      hideTooltip();
    }, 40);
  };

  useEffect(() => {
    return () => {
      if (deactivateTimer.current) clearTimeout(deactivateTimer.current);
    };
  }, []);

  const showTooltipForArc = (
    arc: ArcDatum,
    clientX: number,
    clientY: number,
  ) => {
    showTooltip({
      tooltipData: {
        label: arc.slice.label,
        value: arc.slice.value,
        pct: Math.round((arc.slice.value / total) * 100),
      },
      tooltipLeft: clientX,
      tooltipTop: clientY,
    });
  };

  // Anchor the tooltip to the arc's outer-edge midpoint. Used when the user
  // activates a slice via legend hover or keyboard focus, where no cursor
  // coordinate is available. Without this, keyboard users see the slice pop
  // but miss the percentage + count that mouse users get — violates WCAG
  // 1.4.13 (Content on Hover or Focus).
  const showTooltipForArcAnchoredToSvg = (arc: ArcDatum) => {
    const svgEl = svgRef.current;
    const rect = svgEl?.getBoundingClientRect();
    // If the SVG has no measurable layout (jsdom under tests, or pre-mount),
    // still show the tooltip — `chartTooltipStyle` will clamp it to viewport.
    if (!rect || !rect.width || !rect.height) {
      showTooltipForArc(arc, 0, 0);
      return;
    }

    const anchor = legendTooltipAnchor(arc, rect);
    setLegendCaretOffsetPx(anchor.caretOffset);
    showTooltipForArc(arc, anchor.left, anchor.top);
  };

  const activateFromLegend = (id: string) => {
    setActivationSource("legend");
    activateHover(id);
    const arc = arcData.find((a) => a.slice.id === id);
    if (arc) showTooltipForArcAnchoredToSvg(arc);
  };

  const handleOverlayMouseMove = (
    event: React.MouseEvent<SVGCircleElement>,
  ) => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const rect = svgEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    // xMidYMid meet applies a single uniform scale; compute it from whichever
    // axis is the bottleneck and subtract the resulting letterbox offset before
    // mapping to SVG space.
    const uniformScale = Math.min(
      rect.width / chartSize,
      rect.height / chartSize,
    );
    const letterboxX = (rect.width - chartSize * uniformScale) / 2;
    const letterboxY = (rect.height - chartSize * uniformScale) / 2;
    const svgX =
      (event.clientX - rect.left - letterboxX) / uniformScale - chartCenter;
    const svgY =
      (event.clientY - rect.top - letterboxY) / uniformScale - chartCenter;
    const dist = Math.sqrt(svgX * svgX + svgY * svgY);

    // Only activate within the ring — inner hole and outside edge are dead zones
    if (dist < innerRadius || dist > outerRadius) {
      deactivate();
      return;
    }

    const angle = Math.atan2(svgX, -svgY); // angle from 12 o'clock, clockwise
    for (const arc of arcData) {
      let a = angle;
      if (a < arc.startAngle) a += Math.PI * 2;
      if (a >= arc.startAngle && a <= arc.endAngle) {
        setActivationSource("cursor");
        showTooltipForArc(arc, event.clientX, event.clientY);
        activateHover(arc.slice.id);
        return;
      }
    }
    // Cursor is in a gap — keep current active slice without flickering
    if (tooltipData) {
      showTooltip({
        tooltipData,
        tooltipLeft: event.clientX,
        tooltipTop: event.clientY,
      });
    }
  };

  return (
    <Card className="relative rounded-lg" size="sm">
      <CardContent className="flex flex-1 flex-col">
        <div className="flex items-start gap-2">
          <h3 className="m-0 max-w-[60%] shrink-0 text-sm font-semibold">
            {title}
          </h3>
          {tabs && tabs.length > 1 && (
            <DonutChartTabs
              tabs={tabs}
              activeIndex={activeTabIndex}
              onChange={handleTabChange}
            />
          )}
        </div>
        {errorMessage ? (
          <ChartStatusMessage errorMessage={errorMessage} />
        ) : (
          <div
            className={cn(
              "flex flex-1 gap-3 pt-2",
              layout === "side"
                ? "min-h-0 flex-row items-stretch"
                : "flex-col items-center justify-center",
            )}
          >
            {/*
             * Side layout: SVG takes half the card width and the full available
             * height. preserveAspectRatio="xMidYMid meet" (SVG default) renders
             * the donut as large as possible within that rectangle — no wrapper
             * div needed, no fixed cap that prevents growth on wide monitors.
             */}
            <svg
              ref={svgRef}
              viewBox={`0 0 ${String(chartSize)} ${String(chartSize)}`}
              role="img"
              aria-label={`${title} distribution`}
              className={cn(
                "shrink-0",
                layout === "side" ? "h-full w-1/2" : "w-full max-w-40",
              )}
              style={{ overflow: "visible" }}
            >
              <g
                transform={`translate(${String(chartCenter)},${String(chartCenter)})`}
              >
                {displayedArcs.map((arc) => {
                  const isActive = activeId === arc.slice.id;
                  const accessibleLabel = hasData
                    ? `${arc.slice.label}: ${numberFormatter.format(arc.slice.value)}`
                    : arc.slice.label;
                  return (
                    <g
                      key={arc.slice.id}
                      style={{
                        transform: isActive
                          ? `translate(${String(arc.popX)}px, ${String(arc.popY)}px)`
                          : undefined,
                        transition: "transform 180ms ease-out",
                      }}
                    >
                      <path
                        ref={(el) => {
                          if (el) pathRefs.current.set(arc.slice.id, el);
                          else pathRefs.current.delete(arc.slice.id);
                        }}
                        suppressHydrationWarning
                        // SVG <path> has no implicit ARIA role, so aria-label is a
                        // prohibited attribute (axe aria-prohibited-attr, fires on
                        // WebKit/Firefox which expose no computed role). role="img"
                        // would collide with the parent svg's role="img"; the WAI-ARIA
                        // graphics-symbol role permits a name and keeps the svg as the
                        // sole img-role node.
                        role="graphics-symbol"
                        d={arc.pathD}
                        fill={arc.color}
                        stroke={arc.color}
                        strokeWidth={0.5}
                        aria-label={accessibleLabel}
                        style={{ opacity: arc.opacity }}
                      >
                        <title>{accessibleLabel}</title>
                      </path>
                    </g>
                  );
                })}
                {/*
                 * Single transparent overlay intercepts all mouse events.
                 * Angle + distance math in onMouseMove eliminates gap/hole flicker.
                 */}
                <circle
                  data-testid="chart-overlay"
                  r={outerRadius}
                  fill="transparent"
                  onMouseMove={hasData ? handleOverlayMouseMove : undefined}
                  onMouseLeave={hasData ? deactivate : undefined}
                />
              </g>
            </svg>

            <DonutChartLegend
              slices={slices}
              colorFor={(id) => colorScale(id)}
              activeId={activeId}
              hiddenIds={hiddenIds}
              hasData={hasData}
              layout={layout}
              onActivate={activateFromLegend}
              onDeactivate={deactivate}
              onToggle={toggleSlice}
            />
          </div>
        )}
      </CardContent>
      {tooltipData && (
        <div
          role="status"
          className="pointer-events-none fixed z-50 rounded-md border border-foreground/80 bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
          style={
            activationSource === "legend"
              ? // Center exactly on the anchor via transform (avoids width-
                // estimation error) and float above with room for the ▼ caret.
                {
                  position: "fixed" as const,
                  left: `${String(tooltipLeft ?? 0)}px`,
                  top: `${String((tooltipTop ?? 0) - tooltipEstimatedHeight - 4)}px`,
                  transform: "translateX(-50%)",
                }
              : chartTooltipStyle(
                  tooltipLeft ?? 0,
                  tooltipTop ?? 0,
                  tooltipEstimatedWidth,
                  tooltipEstimatedHeight,
                  12,
                  -36,
                )
          }
        >
          {/* ▼ caret at tooltip bottom, pointing down toward the arc.
              calc(50% + offset) shifts the caret when the tooltip is pushed
              sideways to stay within the SVG bounds, so it still points at
              the arc rather than the tooltip center. */}
          {activationSource === "legend" && (
            <span
              aria-hidden="true"
              className="absolute size-3 border border-foreground/80 bg-popover"
              style={{
                bottom: -7,
                left: `calc(50% + ${String(legendCaretOffsetPx)}px)`,
                transform: "translateX(-50%) rotate(45deg)",
                borderRightWidth: 1,
                borderBottomWidth: 1,
                borderTopColor: "transparent",
                borderLeftColor: "transparent",
              }}
            />
          )}
          {tooltipData.label}: {numberFormatter.format(tooltipData.value)}
          <span className="ml-1 text-muted-foreground">
            ({tooltipData.pct}%)
          </span>
        </div>
      )}
    </Card>
  );
}

export function DonutChart(props: DonutChartProps) {
  return useDonutChart(props);
}
