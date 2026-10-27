"use client";

/**
 * The Compare Region Viewer's figure: one row per genome, aligned on its
 * pinned gene, under a bp ruler, beside a label column, in Comfortable or
 * Compact density. A calm 1× overview whose gene names and ribbons appear as
 * zooming makes room for them.
 *
 * The chart owns the zoom (horizontal only), the hover and pin, the sticky
 * label column and ruler, and keeping the reader's place across a density
 * switch. The panel owns the density preference and the command bar, which
 * the chart renders through `renderBar` so the bar can reach the zoom.
 *
 * Hovering redraws no glyph: the layers under the overlays take only the
 * model and the zoom, and the hover reaches the trace, the rings and
 * Compact's row tint through context.
 */
import { Zoom, type ProvidedZoom, type ZoomState } from "@visx/zoom";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type {
  CompareRegionRow,
  CompareRegionSettings,
} from "@/lib/compare-region/contract";
import {
  densitySpecs,
  labelWidthFor,
  plotWidthFor,
  rulerHeight,
} from "@/lib/compare-region/density";
import type { CompareRegionDensity } from "@/lib/compare-region/density-options";
import { buildChartModel } from "@/lib/compare-region/families";
import { rowAt } from "@/lib/compare-region/figure-frame";
import { constrainToTrack } from "@/lib/compare-region/layout";
import { focusLineX } from "@/lib/compare-region/ruler";
import {
  scrollPlace,
  scrollTopFor,
  type ScrollPlace,
} from "@/lib/compare-region/scroll-place";
import { canvasTextWidth } from "@/lib/compare-region/text-measure";
import { carryMatrix, wheelDelta, zoomLimits } from "@/lib/compare-region/zoom";
import { cn } from "@/lib/utils";
import { GlyphLayer } from "./compare-region-glyphs";
import {
  HighlightLayer,
  HoverContext,
  LabelHighlight,
  PinContext,
  RowHoverContext,
} from "./compare-region-highlight";
import { LabelColumn, LabelHeader } from "./compare-region-label-column";
import { Legend } from "./compare-region-legend";
import { SelectionStrip } from "./compare-region-selection-strip";
import { CompareRegionTooltip } from "./compare-region-tooltip";
import {
  Baselines,
  FocusLine,
  RibbonLayer,
  RowTint,
  RulerAxis,
  TrackBands,
} from "./compare-region-track-layers";
import type { ZoomControls } from "./compare-region-zoom-controls";
import { useChartPointer } from "./use-chart-pointer";

type ChartZoom = ProvidedZoom<SVGSVGElement> & ZoomState;

export interface CompareRegionChartProps {
  /** The route's rows, the focus gene's first. Not empty. */
  rows: readonly CompareRegionRow[];
  /** The width the figure fills, px (the panel measures its card). */
  width: number;
  /** The settings the rows were compared with (the strip's "Compare regions" link carries them). */
  settings: CompareRegionSettings;
  density: CompareRegionDensity;
  onDensityChange: (density: CompareRegionDensity) => void;
  /** The command bar, given the zoom controls and the export action. */
  renderBar: (
    zoom: ZoomControls | null,
    onExport: (() => void) | null,
  ) => ReactNode;
  /** Receives the figure's <svg> for Export. */
  onExport: (svg: SVGSVGElement) => void;
}

/**
 * Sticky in SVG (CSS `position: sticky` does not apply to SVG children): the
 * label column stays left and the ruler and the label header on top while the
 * tracks scroll under them. Each is marked `data-sticky`, so the export can
 * put it back in place.
 */
function stickLayers(
  scroller: HTMLElement,
  labels: SVGGElement | null,
  ruler: SVGGElement | null,
  header: SVGGElement | null,
) {
  const { scrollLeft, scrollTop } = scroller;
  labels?.setAttribute("transform", `translate(${String(scrollLeft)} 0)`);
  ruler?.setAttribute("transform", `translate(0 ${String(scrollTop)})`);
  header?.setAttribute("transform", `translate(0 ${String(scrollTop)})`);
}

/**
 * Carries the zoom to a new plot width (a density switch changes the label
 * column, and so the plot; so does a resize): the same zoom level and the same
 * visible bp range, its pixel translation scaled to the new width. Zoom itself
 * is not remounted, so the bar, the strip and focus are untouched.
 */
function CarryZoom({
  zoom,
  plotWidth,
}: {
  zoom: ChartZoom;
  plotWidth: number;
}) {
  const previousWidth = useRef(plotWidth);
  useLayoutEffect(() => {
    const from = previousWidth.current;
    if (from === plotWidth) return;
    previousWidth.current = plotWidth;
    zoom.setTransformMatrix(carryMatrix(zoom.transformMatrix, from, plotWidth));
  }, [zoom, plotWidth]);
  return null;
}

export function CompareRegionChart({
  rows,
  width,
  settings,
  density,
  onDensityChange,
  renderBar,
  onExport,
}: CompareRegionChartProps) {
  const {
    wheelGuardRef,
    handlers,
    hovered,
    selected,
    setSelected,
    tooltipLeft,
    tooltipTop,
  } = useChartPointer();
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<SVGGElement>(null);
  const rulerRef = useRef<SVGGElement>(null);
  const headerRef = useRef<SVGGElement>(null);
  /** A density switch in flight: where the scroller stood, applied once the new density has rendered. */
  const pendingPlace = useRef<ScrollPlace | null>(null);
  /**
   * The scroller's vertical scrollbar, px: 0 with overlay scrollbars, about
   * 15 with classic ones once the figure is taller than the card. The figure
   * fits beside it, or it would scroll sideways by that much.
   */
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  // Once per answer and density (the React Compiler caches it): while
  // rendering, nothing below hands these to a function that could change
  // them, only to JSX (the handlers and effects read them later).
  const spec = densitySpecs[density];
  const model = buildChartModel(rows, spec);
  const { frame } = model;
  const height = frame.height;
  // The width inside the scroller: `width` is the card's, scrollbar included.
  const figureWidth = Math.max(0, width - scrollbarWidth);
  const labelWidth = labelWidthFor(spec, figureWidth);
  const plotWidth = plotWidthFor(spec, figureWidth);
  const chartWidth = labelWidth + plotWidth;
  const genomes = rows.length === 1 ? "genome" : "genomes";

  // Measured whenever the scroller's content box changes, which a scrollbar
  // appearing or going does; a new plot width carries the zoom (`CarryZoom`).
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const measure = () => {
      setScrollbarWidth(scroller.offsetWidth - scroller.clientWidth);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => {
      observer.disconnect();
    };
  }, []);

  // After a switch: the same rows back in view, in the new density's rows.
  useLayoutEffect(() => {
    const place = pendingPlace.current;
    const scroller = scrollerRef.current;
    if (!place || !scroller) return;
    pendingPlace.current = null;
    scroller.scrollTop = scrollTopFor(place, frame, scroller.clientHeight);
    scroller.scrollLeft = place.left;
    stickLayers(
      scroller,
      labelsRef.current,
      rulerRef.current,
      headerRef.current,
    );
  }, [frame]);

  const switchDensity = (
    next: CompareRegionDensity,
    pinnedRow: number | null,
  ) => {
    if (next === density) return;
    pendingPlace.current = scrollPlace(scrollerRef.current, frame, pinnedRow);
    setHoveredRow(null);
    onDensityChange(next);
  };

  const exportChart = () => {
    if (svgRef.current) onExport(svgRef.current);
  };

  // The layers a zoom or a pan does not change, made here rather than in
  // Zoom's render prop: every zoom then hands React these same elements, so
  // it re-renders none of them (with 50 genomes, the label column alone is
  // hundreds of nodes). Their hover and row-tint overlays still update through
  // context.
  const strip = (
    <SelectionStrip
      model={model}
      settings={settings}
      onClear={() => {
        setSelected(null);
      }}
      density={density}
      onDensityChange={switchDensity}
    />
  );
  const trackBands = (
    <>
      <TrackBands frame={frame} plotWidth={plotWidth} />
      {spec.rowTint && <RowTint frame={frame} x={0} width={plotWidth} />}
    </>
  );
  const labelColumn = (
    <>
      <LabelColumn
        model={model}
        labelWidth={labelWidth}
        measure={canvasTextWidth}
      >
        {spec.rowTint && (
          <RowTint frame={frame} x={0} width={labelWidth - 1} edge />
        )}
      </LabelColumn>
      <LabelHighlight model={model} labelWidth={labelWidth} />
    </>
  );
  const labelHeader = <LabelHeader spec={spec} labelWidth={labelWidth} />;

  return (
    <div ref={wheelGuardRef} className="relative flex min-h-0 flex-col">
      <PinContext value={selected}>
        <HoverContext value={hovered}>
          <RowHoverContext value={hoveredRow}>
            <Zoom<SVGSVGElement>
              width={plotWidth}
              height={height}
              wheelDelta={wheelDelta}
              constrain={(next, prev) =>
                constrainToTrack(next, prev, plotWidth)
              }
            >
              {/* Nothing in here reads the hover: it reaches the trace and tint layers through context. */}
              {(zoom) => {
                const matrix = zoom.transformMatrix;
                const limits = zoomLimits(matrix);
                const controls: ZoomControls = {
                  ...limits,
                  zoomBy: (factor) => {
                    // About the focus line while it is in view, else the middle.
                    const focusX = focusLineX(
                      model.layout.domain,
                      matrix,
                      plotWidth,
                    );
                    const point =
                      focusX >= 0 && focusX <= plotWidth
                        ? { x: focusX, y: height / 2 }
                        : undefined;
                    zoom.scale({ scaleX: factor, scaleY: 1, point });
                  },
                  fit: () => {
                    zoom.clear();
                  },
                };
                return (
                  <>
                    <CarryZoom zoom={zoom} plotWidth={plotWidth} />
                    {renderBar(controls, exportChart)}
                    {strip}
                    {/* Focusable so keyboard users can scroll a figure wider or taller than the card. */}
                    <div
                      ref={scrollerRef}
                      className="min-h-0 overflow-auto"
                      tabIndex={0}
                      role="group"
                      aria-label="Compared regions (scrollable)"
                      onScroll={(event) => {
                        stickLayers(
                          event.currentTarget,
                          labelsRef.current,
                          rulerRef.current,
                          headerRef.current,
                        );
                      }}
                    >
                      <svg
                        ref={svgRef}
                        width={chartWidth}
                        height={height}
                        role="img"
                        aria-label={`Compared regions of ${String(rows.length)} ${genomes}`}
                        className="block text-foreground"
                        fontSize={12}
                        onPointerMove={
                          spec.rowTint
                            ? (event) => {
                                // The row under the pointer, label column and track alike; none under the sticky ruler.
                                const svg = event.currentTarget;
                                const y =
                                  event.clientY -
                                  svg.getBoundingClientRect().top;
                                const scrollTop =
                                  svg.parentElement?.scrollTop ?? 0;
                                setHoveredRow(
                                  y - scrollTop < rulerHeight
                                    ? null
                                    : rowAt(frame, y),
                                );
                              }
                            : undefined
                        }
                        onPointerLeave={
                          spec.rowTint
                            ? () => {
                                setHoveredRow(null);
                              }
                            : undefined
                        }
                      >
                        {/* Zoom's container: its points are measured in this svg, label column excluded. */}
                        <svg
                          ref={zoom.containerRef}
                          x={labelWidth}
                          width={plotWidth}
                          height={height}
                          // Zoom is horizontal only: a vertical touch pan scrolls the page.
                          className={cn(
                            "touch-pan-y",
                            zoom.isDragging ? "cursor-grabbing" : "cursor-grab",
                          )}
                          {...handlers}
                        >
                          {/* The click target between glyphs: a click there clears the pin. */}
                          <rect
                            width={plotWidth}
                            height={height}
                            className="fill-transparent"
                            data-track-background=""
                          />
                          {trackBands}
                          <Baselines
                            model={model}
                            matrix={matrix}
                            plotWidth={plotWidth}
                          />
                          <RibbonLayer
                            model={model}
                            matrix={matrix}
                            plotWidth={plotWidth}
                          />
                          <FocusLine
                            model={model}
                            matrix={matrix}
                            plotWidth={plotWidth}
                          />
                          <GlyphLayer
                            model={model}
                            matrix={matrix}
                            plotWidth={plotWidth}
                            // A drag holds the pointer on the pressed glyph: cull none while it pans.
                            cull={!zoom.isDragging}
                            measure={canvasTextWidth}
                          />
                          <HighlightLayer
                            model={model}
                            matrix={matrix}
                            plotWidth={plotWidth}
                            measure={canvasTextWidth}
                          />
                          <g ref={rulerRef} data-sticky="">
                            <RulerAxis
                              model={model}
                              matrix={matrix}
                              plotWidth={plotWidth}
                            />
                          </g>
                        </svg>
                        <g ref={labelsRef} data-sticky="">
                          {labelColumn}
                          <g ref={headerRef} data-sticky="">
                            {labelHeader}
                          </g>
                        </g>
                      </svg>
                    </div>
                  </>
                );
              }}
            </Zoom>
            <Legend />
          </RowHoverContext>
        </HoverContext>
      </PinContext>
      {/* Outside the scroller, so its overflow does not clip the tooltip. */}
      <CompareRegionTooltip
        model={model}
        at={hovered}
        left={tooltipLeft}
        top={tooltipTop}
      />
    </div>
  );
}
