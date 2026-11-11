"use client";

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
import {
  buildChartModel,
  isSameFeature,
  type ChartModel,
  type FeatureRef,
} from "@/lib/compare-region/families";
import { glyphBox, rowAt } from "@/lib/compare-region/figure-frame";
import {
  revealMatrix,
  revealScroll,
  type RevealBox,
} from "@/lib/compare-region/keyboard";
import { constrainToTrack } from "@/lib/compare-region/layout";
import { focusLineX, trackScale } from "@/lib/compare-region/ruler";
import {
  scrollPlace,
  scrollTopFor,
  type ScrollPlace,
} from "@/lib/compare-region/scroll-place";
import { canvasTextWidth } from "@/lib/compare-region/text-measure";
import { carryMatrix, wheelDelta, zoomLimits } from "@/lib/compare-region/zoom";
import { cn } from "@/lib/utils";
import { FeatureCard } from "./compare-region-feature-card";
import {
  HoverContext,
  PinContext,
  RowHoverContext,
} from "./compare-region-contexts";
import { LabelHighlight } from "./compare-region-highlight";
import {
  IdentityInfo,
  LabelColumn,
  LabelHeader,
} from "./compare-region-label-column";
import { Legend } from "./compare-region-legend";
import { PannedLayers } from "./compare-region-panned-layers";
import { SelectionStrip } from "./compare-region-selection-strip";
import { CompareRegionTooltip } from "./compare-region-tooltip";
import {
  RowTint,
  RulerAxis,
  TrackBands,
} from "./compare-region-track-layers";
import type { ZoomControls } from "./compare-region-zoom-controls";
import { placeFeaturePopupElement } from "./place-feature-popup";
import { glyphSelector, useChartPointer } from "./use-chart-pointer";

type ChartZoom = ProvidedZoom<SVGSVGElement> & ZoomState;

export interface CompareRegionChartProps {
  rows: readonly CompareRegionRow[];
  width: number;
  settings: CompareRegionSettings;
  density: CompareRegionDensity;
  onDensityChange: (density: CompareRegionDensity) => void;
  renderBar: (
    zoom: ZoomControls | null,
    onExport: (() => void) | null,
  ) => ReactNode;
  onExport: (svg: SVGSVGElement) => void;
}

/**
 * Sticky in SVG (CSS `position: sticky` does not apply to SVG children); each
 * is marked `data-sticky` so the export can put it back in place.
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

function FollowZoom({
  matrix,
  place,
}: {
  matrix: ChartZoom["transformMatrix"];
  place: () => void;
}) {
  useLayoutEffect(() => {
    place();
  }, [matrix, place]);
  return null;
}

function RevealFocus({
  zoom,
  model,
  at,
  plotWidth,
  labelWidth,
  scrollTo,
}: {
  zoom: ChartZoom;
  model: ChartModel;
  at: FeatureRef | undefined;
  plotWidth: number;
  labelWidth: number;
  scrollTo: (box: RevealBox) => void;
}) {
  const revealed = useRef(at);
  useLayoutEffect(() => {
    if (revealed.current === at) return;
    revealed.current = at;
    const item =
      at && model.layout.rows.at(at.rowIndex)?.features.at(at.featureIndex);
    const rowFrame = at && model.frame.rows.at(at.rowIndex);
    if (!item || !rowFrame) return;
    const { domain } = model.layout;
    const matrix = revealMatrix(domain, zoom.transformMatrix, plotWidth, item);
    if (matrix !== zoom.transformMatrix) zoom.setTransformMatrix(matrix);
    const x = trackScale(domain, matrix, plotWidth);
    const { top, bottom } = glyphBox(model.spec, rowFrame, item);
    scrollTo({
      left: labelWidth + Math.min(x(item.from), x(item.to)),
      right: labelWidth + Math.max(x(item.from), x(item.to)),
      top,
      bottom,
    });
  }, [zoom, model, at, plotWidth, labelWidth, scrollTo]);
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
  const [cardExpanded, setCardExpanded] = useState(true);
  const spec = densitySpecs[density];
  const model = buildChartModel(rows, spec);
  const { frame } = model;
  const height = frame.height;
  const {
    wheelGuardRef,
    handlers,
    hovered,
    focused,
    tabStop,
    pressed,
    selected,
    setSelected,
  } = useChartPointer(model.layout, () => {
    setCardExpanded(true);
  });
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const labelsRef = useRef<SVGGElement>(null);
  const rulerRef = useRef<SVGGElement>(null);
  const headerRef = useRef<SVGGElement>(null);
  const pendingPlace = useRef<ScrollPlace | null>(null);
  /**
   * 0 with overlay scrollbars, about 15 with classic ones; the figure fits
   * beside it or it would scroll sideways by that much.
   */
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  const figureWidth = Math.max(0, width - scrollbarWidth);
  const labelWidth = labelWidthFor(spec, figureWidth);
  const plotWidth = plotWidthFor(spec, figureWidth);
  const chartWidth = labelWidth + plotWidth;
  const genomes = rows.length === 1 ? "genome" : "genomes";

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

  const scrollTo = (box: RevealBox) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const place = revealScroll(
      {
        left: scroller.scrollLeft,
        top: scroller.scrollTop,
        width: scroller.clientWidth,
        height: scroller.clientHeight,
      },
      box,
      { left: labelWidth, top: rulerHeight },
    );
    scroller.scrollLeft = place.left;
    scroller.scrollTop = place.top;
  };

  const clearPin = () => {
    const active = document.activeElement;
    const leaving =
      active instanceof Element &&
      (cardRef.current?.contains(active) ||
        active.closest("[data-selection-strip]") !== null);
    setSelected(null);
    if (!leaving || !selected) return;
    const gene = scrollerRef.current?.querySelector<SVGElement>(
      glyphSelector(selected),
    );
    (gene ?? scrollerRef.current)?.focus({ preventScroll: true });
  };

  const tooltipAt = isSameFeature(hovered, selected) ? undefined : hovered;
  const placeTooltip = () => {
    placeFeaturePopupElement({
      popup: tooltipRef.current,
      root: wheelGuardRef.current,
      scroller: scrollerRef.current,
      at: tooltipAt,
      labelWidth,
    });
  };
  const placeCard = () => {
    placeFeaturePopupElement({
      popup: cardRef.current,
      root: wheelGuardRef.current,
      scroller: scrollerRef.current,
      at: selected,
      labelWidth,
    });
  };
  const placePopups = () => {
    placeTooltip();
    placeCard();
  };
  const attachTooltip = (node: HTMLDivElement | null) => {
    tooltipRef.current = node;
    if (node) placeTooltip();
    return () => {
      tooltipRef.current = null;
    };
  };
  const attachCard = (node: HTMLDivElement | null) => {
    cardRef.current = node;
    if (!node || typeof ResizeObserver === "undefined") return;
    // Next frame, not in the observer's callback: placing sets the card's
    // height (`--popup-max-h`), which would loop the observer.
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(placeCard);
    });
    observer.observe(node);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      cardRef.current = null;
    };
  };
  const card =
    selected ? (
      <FeatureCard
        ref={attachCard}
        model={model}
        at={selected}
        expanded={cardExpanded}
        onExpandedChange={setCardExpanded}
        onClose={clearPin}
      />
    ) : null;

  const strip = (
    <SelectionStrip
      model={model}
      settings={settings}
      onClear={clearPin}
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
  const identityInfo = (
    <IdentityInfo
      spec={spec}
      labelWidth={labelWidth}
      measure={canvasTextWidth}
    />
  );

  return (
    <div ref={wheelGuardRef} className="relative flex min-h-0 flex-1 flex-col">
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
              {(zoom) => {
                const matrix = zoom.transformMatrix;
                const limits = zoomLimits(matrix);
                const controls: ZoomControls = {
                  ...limits,
                  zoomBy: (factor) => {
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
                    <RevealFocus
                      zoom={zoom}
                      model={model}
                      at={focused}
                      plotWidth={plotWidth}
                      labelWidth={labelWidth}
                      scrollTo={scrollTo}
                    />
                    <FollowZoom matrix={matrix} place={placePopups} />
                    {renderBar(controls, exportChart)}
                    {strip}
                    <div className="relative flex min-h-0 flex-1 flex-col">
                      {identityInfo}
                      <div
                        ref={scrollerRef}
                        className="min-h-0 flex-1 overflow-auto"
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
                          placePopups();
                        }}
                      >
                        <svg
                          ref={svgRef}
                          width={chartWidth}
                          height={height}
                          role="group"
                          aria-label={`Compared regions of ${String(rows.length)} ${genomes}`}
                          className="block text-foreground"
                          fontSize={12}
                          onPointerMove={
                            spec.rowTint
                              ? (event) => {
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
                          <svg
                            ref={zoom.containerRef}
                            x={labelWidth}
                            width={plotWidth}
                            height={height}
                            // Zoom's move handler reads isDragging from its
                            // last render, so a move before this render does
                            // not pan yet.
                            data-dragging={zoom.isDragging ? "" : undefined}
                            // Zoom is horizontal only: a vertical touch pan scrolls the page.
                            className={cn(
                              "touch-pan-y",
                              zoom.isDragging
                                ? "cursor-grabbing"
                                : "cursor-grab **:data-feature:cursor-pointer",
                            )}
                            {...handlers}
                          >
                            <rect
                              width={plotWidth}
                              height={height}
                              className="fill-transparent"
                              data-track-background=""
                            />
                            {trackBands}
                            <PannedLayers
                              model={model}
                              matrix={matrix}
                              dragging={zoom.isDragging}
                              pressed={pressed}
                              tabStop={tabStop}
                              plotWidth={plotWidth}
                              measure={canvasTextWidth}
                            />
                            <g ref={rulerRef} data-sticky="" aria-hidden>
                              <RulerAxis
                                model={model}
                                matrix={matrix}
                                plotWidth={plotWidth}
                              />
                            </g>
                          </svg>
                          <g ref={labelsRef} data-sticky="" aria-hidden>
                            {labelColumn}
                            <g ref={headerRef} data-sticky="">
                              {labelHeader}
                            </g>
                          </g>
                        </svg>
                      </div>
                    </div>
                  </>
                );
              }}
            </Zoom>
            <Legend />
          </RowHoverContext>
        </HoverContext>
      </PinContext>
      <CompareRegionTooltip ref={attachTooltip} model={model} at={tooltipAt} />
      {card}
    </div>
  );
}
