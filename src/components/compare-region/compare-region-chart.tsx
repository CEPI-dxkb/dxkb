"use client";

import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { Bar, Line } from "@visx/shape";
import { TooltipWithBounds, useTooltip } from "@visx/tooltip";
import { Zoom, type TransformMatrix } from "@visx/zoom";
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from "react";
import { Button } from "@/components/ui/button";
import { featureFill } from "@/lib/compare-region/colors";
import {
  isCompareRegionLinkable,
  type CompareRegionFeature,
  type CompareRegionRow,
} from "@/lib/compare-region/contract";
import {
  constrainToTrack,
  glyphPath,
  glyphShape,
  laneHeight,
  layoutCompareRegion,
  topMargin,
  type CompareRegionLayout,
  type PlacedRow,
} from "@/lib/compare-region/layout";
import { cn } from "@/lib/utils";
import { featureHref } from "@/lib/views/hrefs";

/** Width of the genome-name column, px (legacy's). */
const labelWidth = 250;
const tooltipOffset = 12;
/** A pointer that moved further than this between press and release dragged, not clicked. */
const clickSlop = 4;
/** What the tooltip and the selection bar say for a feature with no annotated function. */
const noProduct = "No product";
const bp = new Intl.NumberFormat("en-US");

/** A feature, by its row's and its own index in the layout. */
interface FeatureRef {
  rowIndex: number;
  featureIndex: number;
}

interface ResolvedFeature {
  row: CompareRegionRow;
  feature: CompareRegionFeature;
}

/**
 * ⌘ + wheel zooms 20% a notch, horizontally only. Ctrl + wheel and a trackpad
 * pinch never get here: use-gesture hands them to Zoom as a pinch, which steps
 * by Zoom's default `pinchDelta` (10% an event; `constrainToTrack` keeps it
 * horizontal). A pinch sends many small events, so 20% there would be too fast.
 * Its anchor at the pointer needs `patches/@visx__zoom@4.0.0.patch`.
 */
function wheelDelta(event: Pick<WheelEvent, "deltaY">) {
  return { scaleX: event.deltaY < 0 ? 1.2 : 1 / 1.2, scaleY: 1 };
}

function resolve(layout: CompareRegionLayout, ref: FeatureRef): ResolvedFeature | null {
  const placed = layout.rows.at(ref.rowIndex);
  const item = placed?.features.at(ref.featureIndex);
  return placed && item ? { row: placed.row, feature: item.feature } : null;
}

/** Only a CDS has the Compare Region tab, so only a `.peg.` gets a comparison link. */
function hasCompareRegionTab(fid: string): boolean {
  return /^fig\|.+\.peg\.\d+$/.test(fid);
}

/** The feature a pointer event landed on, from the glyph's data attributes. */
function featureAt(target: EventTarget): FeatureRef | null {
  if (!(target instanceof Element)) return null;
  const glyph = target.closest("[data-feature]");
  if (!glyph) return null;
  return {
    rowIndex: Number(glyph.getAttribute("data-row")),
    featureIndex: Number(glyph.getAttribute("data-feature")),
  };
}

function formatLocation(feature: CompareRegionFeature): string {
  const size = bp.format(Math.abs(feature.end - feature.start) + 1);
  const strand = feature.strand ? `, ${feature.strand}` : "";
  return `${bp.format(feature.start)}…${bp.format(feature.end)} (${size} bp${strand})`;
}

function FeatureSummary({ row, feature }: ResolvedFeature) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
      <dt className="font-medium">ID</dt>
      <dd>{feature.fid}</dd>
      <dt className="font-medium">Product</dt>
      <dd>{feature.product || noProduct}</dd>
      <dt className="font-medium">Location</dt>
      <dd>{formatLocation(feature)}</dd>
      {feature.familyId && (
        <>
          <dt className="font-medium">Family</dt>
          <dd>{feature.familyId}</dd>
        </>
      )}
      {feature.identity !== null && (
        <>
          <dt className="font-medium">Identity</dt>
          <dd>{`${String(feature.identity)}% to the focus gene`}</dd>
        </>
      )}
      <dt className="font-medium">Genome</dt>
      <dd>{row.genomeName}</dd>
    </dl>
  );
}

/**
 * Genome names: the first three words, then the rest on a second line (legacy).
 * The fragment matters: the React Compiler only treats a function as a
 * component, and caches it, when it makes JSX outside a callback.
 */
function RowLabels({ layout }: { layout: CompareRegionLayout }) {
  return (
    <>
      {layout.rows.map(({ row, firstLane }, index) => {
        const y = topMargin + firstLane * laneHeight;
        const words = row.genomeName.split(" ");
        return (
          <text key={`${row.genomeId}:${String(index)}`} x={5} y={y + 5} fill="currentColor">
            <title>{row.genomeName}</title>
            <tspan>{words.slice(0, 3).join(" ")}</tspan>
            {words.length > 3 && (
              <tspan x={15} dy={15}>
                {words.slice(3).join(" ")}
              </tspan>
            )}
          </text>
        );
      })}
    </>
  );
}

interface TrackRowProps {
  placed: PlacedRow;
  rowIndex: number;
  x: (offset: number) => number;
  plotWidth: number;
  selectedFeature: number | null;
  /** Skip glyphs off screen. */
  cull: boolean;
}

function TrackRow({ placed, rowIndex, x, plotWidth, selectedFeature, cull }: TrackRowProps) {
  const { row } = placed;
  const baselineFrom = x(placed.baselineFrom);
  const baselineTo = x(placed.baselineTo);
  return (
    <Group top={topMargin + placed.firstLane * laneHeight}>
      <Line from={{ x: baselineFrom, y: 0 }} to={{ x: baselineTo, y: 0 }} stroke="currentColor" />
      {placed.contigStartShown && (
        <Line from={{ x: baselineFrom, y: -5 }} to={{ x: baselineFrom, y: 5 }} stroke="currentColor" />
      )}
      {placed.contigEndShown && (
        <Line from={{ x: baselineTo, y: -5 }} to={{ x: baselineTo, y: 5 }} stroke="currentColor" />
      )}
      {placed.features.map((item, featureIndex) => {
        const x1 = x(item.from);
        const x2 = x(item.to);
        // Zoomed in, most glyphs are off screen: skip them.
        if (cull && (Math.max(x1, x2) < 0 || Math.min(x1, x2) > plotWidth)) return null;
        const pinned = item.feature.fid === row.pinnedFid;
        return (
          <Group key={`${item.feature.fid}:${String(featureIndex)}`} top={item.lane * laneHeight}>
            <path
              d={glyphPath(glyphShape(item.feature.type), x1, x2)}
              fill={featureFill(item.feature, row.pinnedFid)}
              stroke="currentColor"
              strokeWidth={featureIndex === selectedFeature ? 3 : pinned ? 2 : 1}
              data-row={rowIndex}
              data-feature={featureIndex}
            />
            {item.feature.family !== null && (
              <text
                x={(x1 + x2) / 2}
                y={-12}
                textAnchor="middle"
                fontSize={9}
                fill="currentColor"
                pointerEvents="none"
              >
                {item.feature.family}
              </text>
            )}
          </Group>
        );
      })}
    </Group>
  );
}

interface TracksProps {
  layout: CompareRegionLayout;
  matrix: TransformMatrix;
  plotWidth: number;
  selected: FeatureRef | null;
  /**
   * A drag is panning. It draws every glyph then: use-gesture captures the
   * pointer on the pressed glyph, and removing that glyph once it is panned
   * out of view would lose the capture, and with it the drag's end.
   */
  dragging: boolean;
}

/**
 * Every row's baseline and glyphs. It is its own component, returning a
 * fragment, so the React Compiler caches it by these props. Hovering changes
 * only the chart's tooltip state, which none of them carries, so it redraws
 * no glyph; a zoom or pan changes `matrix`, which rescales x without
 * recomputing the layout (the chart computes that once per answer).
 */
function Tracks({ layout, matrix, plotWidth, selected, dragging }: TracksProps) {
  const x = scaleLinear<number>({
    domain: layout.domain,
    range: [matrix.translateX, matrix.translateX + plotWidth * matrix.scaleX],
  });
  return (
    <>
      {layout.rows.map((placed, rowIndex) => (
        <TrackRow
          key={`${placed.row.genomeId}:${String(rowIndex)}`}
          placed={placed}
          rowIndex={rowIndex}
          x={x}
          plotWidth={plotWidth}
          selectedFeature={selected?.rowIndex === rowIndex ? selected.featureIndex : null}
          cull={!dragging}
        />
      ))}
    </>
  );
}

interface FeatureTooltipProps {
  layout: CompareRegionLayout;
  /** The hovered glyph, or nothing when the tooltip is closed. */
  at: FeatureRef | undefined;
  left: number | undefined;
  top: number | undefined;
}

/** The hovered feature's details, beside the pointer. */
function FeatureTooltip({ layout, at, left, top }: FeatureTooltipProps) {
  const hovered = at ? resolve(layout, at) : null;
  if (!hovered) return null;
  return (
    <TooltipWithBounds
      left={left}
      top={top}
      unstyled
      className="pointer-events-none absolute z-10 max-w-sm rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md"
    >
      <FeatureSummary row={hovered.row} feature={hovered.feature} />
    </TooltipWithBounds>
  );
}

interface ToolbarProps {
  layout: CompareRegionLayout;
  selected: FeatureRef | null;
  onClear: () => void;
  onZoom: (factor: number) => void;
  onReset: () => void;
}

function Toolbar({ layout, selected, onClear, onZoom, onReset }: ToolbarProps) {
  const chosen = selected ? resolve(layout, selected) : null;
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-x-4 gap-y-1 border-b px-3 py-1.5 text-sm">
      {chosen ? (
        <>
          <span className="font-medium">{chosen.feature.fid}</span>
          <span className="text-muted-foreground">{chosen.feature.product || noProduct}</span>
          {isCompareRegionLinkable(chosen.feature.fid) && (
            <Link className="text-link hover:underline" href={featureHref(chosen.feature.fid)}>
              Open feature
            </Link>
          )}
          {hasCompareRegionTab(chosen.feature.fid) && (
            <Link
              className="text-link hover:underline"
              href={`${featureHref(chosen.feature.fid)}?tab=compare-region`}
            >
              Compare regions around this gene
            </Link>
          )}
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Clear selection" onClick={onClear}>
            <X />
          </Button>
        </>
      ) : (
        <span className="text-xs text-muted-foreground">
          Click a gene for its links. Drag to pan; Ctrl/⌘ + scroll or the buttons zoom.
        </span>
      )}
      <div className="ml-auto flex gap-1">
        <Button type="button" variant="outline" size="icon-sm" aria-label="Zoom in" onClick={() => { onZoom(1.5); }}>
          <Plus />
        </Button>
        <Button type="button" variant="outline" size="icon-sm" aria-label="Zoom out" onClick={() => { onZoom(1 / 1.5); }}>
          <Minus />
        </Button>
        <Button type="button" variant="outline" size="icon-sm" aria-label="Reset zoom" onClick={onReset}>
          <RotateCcw />
        </Button>
      </div>
    </div>
  );
}

export interface CompareRegionChartProps {
  /** The route's rows, the focus gene's first. Not empty. */
  rows: readonly CompareRegionRow[];
  /** The width the chart fills, px (the panel measures it). */
  width: number;
  /** Receives the outer <svg>, for Export. */
  svgRef?: Ref<SVGSVGElement>;
}

export function CompareRegionChart({ rows, width, svgRef }: CompareRegionChartProps) {
  // The React Compiler computes this once per answer only while nothing in
  // this body could mutate it: features are resolved from it in the
  // components that show one (`Toolbar`, `FeatureTooltip`), not here.
  const layout = layoutCompareRegion(rows);
  const plotWidth = Math.max(width - labelWidth, 200);
  // Wider than `width` when the tracks hit their floor; the chart then scrolls sideways.
  const chartWidth = labelWidth + plotWidth;
  const height = topMargin + layout.laneCount * laneHeight;
  const wheelGuardRef = useRef<HTMLDivElement>(null);
  const pressedAt = useRef<number | null>(null);
  const [selected, setSelected] = useState<FeatureRef | null>(null);
  const { tooltipOpen, tooltipData, tooltipLeft, tooltipTop, showTooltip, hideTooltip } =
    useTooltip<FeatureRef>();

  // A plain wheel scrolls the page past the chart; Ctrl/⌘ + wheel (and a
  // trackpad pinch, which browsers send as one) zooms. Stopping a plain wheel
  // here, in the capture phase, keeps it from Zoom's non-passive listener,
  // which would cancel the scroll. Same rule as `choropleth-svg.tsx`. It
  // never cancels a wheel itself, so it is passive. The guard is the element
  // around `<Zoom key={plotWidth}>`, not one inside it: a width change
  // remounts everything inside, and would leave this listener on a detached
  // node. It is also the box the tooltip is placed in.
  useEffect(() => {
    const node = wheelGuardRef.current;
    if (!node) return;
    const passPlainWheelToPage = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) event.stopPropagation();
    };
    node.addEventListener("wheel", passPlainWheelToPage, {
      capture: true,
      passive: true,
    });
    return () => {
      node.removeEventListener("wheel", passPlainWheelToPage, { capture: true });
    };
  }, []);

  // One handler for every glyph (event delegation), on entering one, not on every move.
  const handlePointerOver = (event: ReactPointerEvent<SVGSVGElement>) => {
    const ref = featureAt(event.target);
    const box = wheelGuardRef.current?.getBoundingClientRect();
    // `buttons`: no tooltip while a drag is panning.
    if (!ref || !box || event.buttons !== 0) {
      hideTooltip();
      return;
    }
    showTooltip({
      tooltipData: ref,
      tooltipLeft: event.clientX - box.left + tooltipOffset,
      tooltipTop: event.clientY - box.top + tooltipOffset,
    });
  };

  const handleClick = (event: ReactMouseEvent<SVGSVGElement>) => {
    const pressed = pressedAt.current;
    pressedAt.current = null;
    if (pressed !== null && Math.abs(event.clientX - pressed) > clickSlop) return;
    setSelected(featureAt(event.target));
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    pressedAt.current = event.clientX;
    // A drag pans the glyphs away from an open tooltip.
    hideTooltip();
  };

  return (
    <div ref={wheelGuardRef} className="relative flex flex-col">
      {/* A new width restarts the zoom: the old translation is in old pixels. */}
      <Zoom<SVGSVGElement>
        key={plotWidth}
        width={plotWidth}
        height={height}
        wheelDelta={wheelDelta}
        constrain={(next, prev) => constrainToTrack(next, prev, plotWidth)}
      >
        {/* Nothing in here depends on the tooltip, so a hover re-renders none of it. */}
        {(zoom) => (
          <>
            <Toolbar
              layout={layout}
              selected={selected}
              onClear={() => { setSelected(null); }}
              onZoom={(factor) => { zoom.scale({ scaleX: factor, scaleY: 1 }); }}
              onReset={() => { zoom.reset(); }}
            />
            {/* Focusable so keyboard users can scroll a chart wider than the
                panel (axe scrollable-region-focusable). */}
            <div
              className="overflow-x-auto"
              tabIndex={0}
              role="group"
              aria-label="Compared regions (scrollable)"
            >
              <svg
                ref={svgRef}
                width={chartWidth}
                height={height}
                role="img"
                aria-label={`Compared regions of ${String(rows.length)} ${rows.length === 1 ? "genome" : "genomes"}`}
                className="block text-foreground"
                fontSize={12}
              >
                {/* Nested svgs clip: long names, and glyphs outside the window. */}
                <svg width={labelWidth} height={height}>
                  <RowLabels layout={layout} />
                </svg>
                {/* Zoom's container: its points are measured in this svg, label column excluded. */}
                <svg
                  ref={zoom.containerRef}
                  x={labelWidth}
                  width={plotWidth}
                  height={height}
                  // Zoom is horizontal only: a vertical touch pan scrolls the page.
                  className={cn("touch-pan-y", zoom.isDragging ? "cursor-grabbing" : "cursor-grab")}
                  onPointerDown={handlePointerDown}
                  onPointerOver={handlePointerOver}
                  onPointerLeave={hideTooltip}
                  onClick={handleClick}
                >
                  <Bar width={plotWidth} height={height} fill="transparent" data-track-background="" />
                  <Tracks
                    layout={layout}
                    matrix={zoom.transformMatrix}
                    plotWidth={plotWidth}
                    selected={selected}
                    dragging={zoom.isDragging}
                  />
                </svg>
              </svg>
            </div>
          </>
        )}
      </Zoom>
      {/* Outside the scroller, so its overflow does not clip the tooltip. */}
      <FeatureTooltip
        layout={layout}
        at={tooltipOpen ? tooltipData : undefined}
        left={tooltipLeft}
        top={tooltipTop}
      />
    </div>
  );
}
