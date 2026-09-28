"use client";

import { Zoom } from "@visx/zoom";
import { Minus, Plus, RotateCcw } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { Button } from "@/components/ui/button";
import type { OrganismGeoDistribution } from "@/lib/services/organisms/types";
import { cn } from "@/lib/utils";

import type { HoverEnter, HoverLeave, HoverPayload } from "./choropleth-path";
import type { ColorScale } from "./color-scale";
import { countyPadding, mapHeight } from "./map-constants";
import { StateCountiesLayer } from "./state-counties-layer";
import {
  crossesAntimeridian,
  extractFeatures,
  type CountryFeature,
  type CountyFeature,
  type StateFeature,
  type TopologyLike,
} from "./topology-utils";
import { UsStatesLayer } from "./us-states-layer";
import { WorldCountriesLayer } from "./world-countries-layer";
import type { GeoMapState } from "./types";

export type { HoverPayload } from "./choropleth-path";

export interface ChoroplethHandle {
  reset: () => void;
}

interface ChoroplethSvgProps {
  data: OrganismGeoDistribution;
  colorScale: ColorScale;
  mapState: GeoMapState;
  onSelectState: (fips: string, name: string) => void;
  onSwitchToUs: () => void;
  worldTopo: TopologyLike | null;
  worldTopoLoading: boolean;
  worldTopoError: string | null;
  stateTopo: TopologyLike | null;
  stateTopoError: string | null;
  countyTopo: TopologyLike | null;
  countyTopoLoading: boolean;
  countyTopoError: string | null;
  onHoverChange: (
    payload: HoverPayload | null,
    event: ReactPointerEvent<SVGPathElement>,
  ) => void;
  onLeaveMap: () => void;
}

export const ChoroplethSvg = forwardRef<ChoroplethHandle, ChoroplethSvgProps>(
  function ChoroplethSvg(
    {
      data,
      colorScale,
      mapState,
      onSelectState,
      onSwitchToUs,
      worldTopo,
      worldTopoLoading,
      worldTopoError,
      stateTopo,
      stateTopoError,
      countyTopo,
      countyTopoLoading,
      countyTopoError,
      onHoverChange,
      onLeaveMap,
    }: ChoroplethSvgProps,
    ref,
  ) {
    const hoverEnter: HoverEnter = (payload, event) => {
      onHoverChange(payload, event);
    };
    const hoverLeave: HoverLeave = () => {
      onLeaveMap();
    };
    const [width, setWidth] = useState(800);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const isDraggingRef = useRef(false);
    const zoomImperativeRef = useRef<{
      reset: () => void;
      scale: (args: { scaleX: number; scaleY: number }) => void;
    } | null>(null);

    useEffect(() => {
      const node = containerRef.current;
      if (!node) return;
      let isFirstObservation = true;
      let resizeTimer: ReturnType<typeof setTimeout> | null = null;
      const ro = new ResizeObserver((entries) => {
        const next = entries[0]?.contentRect?.width;
        if (!next || next <= 0) return;
        // Fire immediately on first observation so initial render has correct width.
        // Debounce all subsequent events so the SVG doesn't re-render on every frame
        // of a CSS width transition (e.g. collapsing the nav sidebar).
        if (isFirstObservation) {
          isFirstObservation = false;
          setWidth(next);
          return;
        }
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          setWidth(next);
        }, 20);
      });
      ro.observe(node);
      return () => {
        ro.disconnect();
        if (resizeTimer) clearTimeout(resizeTimer);
      };
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        reset: () => zoomImperativeRef.current?.reset(),
      }),
      [],
    );

    const stateFeatures: StateFeature[] = stateTopo
      ? extractFeatures(stateTopo, "states")
      : [];
    const countryFeatures: CountryFeature[] = worldTopo
      ? extractFeatures(worldTopo, "countries")
      : [];
    const fips = mapState.selectedStateFips;
    const countyFeatures: CountyFeature[] =
      countyTopo && fips
        ? extractFeatures(countyTopo, "counties").filter(
            (feature) => String(feature.id ?? "").startsWith(fips),
          )
        : [];

    // Exclude antimeridian-crossing counties from fit bounds so Alaska does not
    // produce a near-global bounding box.
    const safeCountyFeatures = countyFeatures.filter(
      (feature) => !crossesAntimeridian(feature),
    );
    const countyFitFeatures =
      safeCountyFeatures.length > 0 ? safeCountyFeatures : countyFeatures;
    const countyFitExtent: [[number, number], [number, number]] | null =
      countyFeatures.length === 0
        ? null
        : [
            [countyPadding, countyPadding],
            [
              Math.max(width - countyPadding, countyPadding + 1),
              mapHeight - countyPadding,
            ],
          ];

    // AlbersUsa standard: scale=1070 at translate [487,305] fits US in ~960×600.
    // Tie to mapHeight so the full US (including Alaska/Hawaii insets) fits vertically.
    const albersScale = mapHeight * 1.55;
    const worldScale = Math.min(width / 6.3, mapHeight * 0.29);

    return (
      <div
        ref={containerRef}
        className="relative flex w-full items-center justify-center overflow-hidden rounded-md bg-muted/30"
        style={{ height: mapHeight }}
        onPointerLeave={onLeaveMap}
      >
        <Zoom<SVGSVGElement>
          width={width}
          height={mapHeight}
          scaleXMin={0.6}
          scaleXMax={10}
          scaleYMin={0.6}
          scaleYMax={10}
        >
          {(zoom) => {
            // Update ref every frame — no setState so no re-render cascade.
            isDraggingRef.current = zoom.isDragging;
            zoomImperativeRef.current = {
              reset: zoom.reset,
              scale: zoom.scale,
            };

            return (
              <>
                <svg
                  width={width}
                  height={mapHeight}
                  ref={zoom.containerRef}
                  role="img"
                  aria-label="Genome distribution map"
                  className={cn(
                    "shrink-0 touch-none",
                    zoom.isDragging ? "cursor-grabbing" : "cursor-grab",
                  )}
                  onWheel={(event) => {
                    event.preventDefault();
                    const next = event.deltaY < 0 ? 1.15 : 1 / 1.15;
                    zoom.scale({ scaleX: next, scaleY: next });
                  }}
                >
                  <g transform={zoom.toString()}>
                    {mapState.view === "world" &&
                      (worldTopoLoading ? null : worldTopoError ? null : countryFeatures.length >
                        0 ? (
                        <WorldCountriesLayer
                          countryFeatures={countryFeatures}
                          scale={worldScale}
                          width={width}
                          data={data}
                          colorScale={colorScale}
                          isDraggingRef={isDraggingRef}
                          onHoverEnter={hoverEnter}
                          onHoverLeave={hoverLeave}
                          onSwitchToUs={onSwitchToUs}
                        />
                      ) : null)}

                    {mapState.view === "us" &&
                      !stateTopoError &&
                      stateFeatures.length > 0 && (
                        <UsStatesLayer
                          stateFeatures={stateFeatures}
                          scale={albersScale}
                          width={width}
                          data={data}
                          colorScale={colorScale}
                          isDraggingRef={isDraggingRef}
                          onHoverEnter={hoverEnter}
                          onHoverLeave={hoverLeave}
                          onSelectState={onSelectState}
                        />
                      )}

                    {mapState.view === "state" &&
                      !countyTopoError &&
                      !countyTopoLoading &&
                      countyFeatures.length > 0 &&
                      countyFitExtent && (
                        <StateCountiesLayer
                          countyFeatures={countyFeatures}
                          fitBoundsFeatures={countyFitFeatures}
                          fitExtent={countyFitExtent}
                          data={data}
                          colorScale={colorScale}
                          isDraggingRef={isDraggingRef}
                          onHoverEnter={hoverEnter}
                          onHoverLeave={hoverLeave}
                          selectedStateName={mapState.selectedStateName}
                        />
                      )}
                  </g>
                </svg>

                {/* Overlay messages rendered outside the zoom SVG */}
                {mapState.view === "world" && worldTopoLoading && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                    Loading world map…
                  </div>
                )}
                {mapState.view === "world" && worldTopoError && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                    Could not load world map data.
                  </div>
                )}
                {mapState.view === "us" && stateTopoError && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                    Could not load US map data.
                  </div>
                )}
                {mapState.view === "state" && countyTopoLoading && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                    Loading county map…
                  </div>
                )}
                {mapState.view === "state" && countyTopoError && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                    Could not load county map data.
                  </div>
                )}
                {mapState.view === "state" &&
                  !countyTopoError &&
                  !countyTopoLoading &&
                  (countyFeatures.length === 0 || !countyFitExtent) && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                      Select a state to drill into county-level data.
                    </div>
                  )}

                <div className="absolute right-3 bottom-3 flex flex-col gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="Zoom in"
                    className="shadow-sm"
                    onClick={() => {
                      zoom.scale({ scaleX: 1.4, scaleY: 1.4 });
                    }}
                  >
                    <Plus />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="Zoom out"
                    className="shadow-sm"
                    onClick={() => {
                      zoom.scale({ scaleX: 1 / 1.4, scaleY: 1 / 1.4 });
                    }}
                  >
                    <Minus />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="Reset zoom"
                    className="shadow-sm"
                    onClick={() => {
                      zoom.reset();
                    }}
                  >
                    <RotateCcw />
                  </Button>
                </div>
              </>
            );
          }}
        </Zoom>
      </div>
    );
  },
);
