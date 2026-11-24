"use client";

import { identityMatrix, Zoom, type TransformMatrix } from "@visx/zoom";
import { Minus, Plus, RotateCcw } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

import { Button } from "@/components/ui/button";
import type { OrganismGeoDistribution } from "@/lib/services/organisms/types";
import { cn } from "@/lib/utils";

import type { HoverEnter, HoverLeave, HoverPayload } from "./choropleth-path";
import { isUsaTopoName, type ColorScale } from "./color-scale";
import {
  countryFitPadding,
  countryZoomMs,
  countyPadding,
  mapHeight,
  mapScaleMax,
  mapScaleMin,
} from "./map-constants";
import { StateCountiesLayer } from "./state-counties-layer";
import {
  crossesAntimeridian,
  extractFeatures,
  featureName,
  type CountryFeature,
  type CountyFeature,
  type StateFeature,
  type TopologyLike,
} from "./topology-utils";
import { UsStatesLayer } from "./us-states-layer";
import { WorldCountriesLayer } from "./world-countries-layer";
import type { GeoMapState } from "./types";
import {
  animateTransform,
  countryBounds,
  fitTransform,
  prefersReducedMotion,
  worldMapScale,
  worldProjection,
  type Bounds,
  type Viewport,
  type ZoomLimits,
} from "./zoom-to-feature";

export type { HoverPayload } from "./choropleth-path";

export interface ChoroplethHandle {
  reset: () => void;
  // Zooms the World view to a country by its topology name (what `data-region` holds). Starts
  // the same animated fit a click does. Returns false, and does nothing, for an unknown
  // name, the USA (a click opens the US view instead), another view, an unloaded map, or a
  // country with no measurable bounds.
  zoomToCountry: (name: string) => boolean;
}

interface ChoroplethSvgProps {
  data: OrganismGeoDistribution;
  colorScale: ColorScale;
  mapState: GeoMapState;
  onSelectState?: ((fips: string, name: string) => void) | undefined;
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

interface ZoomHandle {
  reset: () => void;
  setTransformMatrix: (matrix: TransformMatrix) => void;
  transformMatrix: TransformMatrix;
}

type CancelZoomRef = RefObject<(() => void) | null>;

// The same limits bound <Zoom> and the country fit: Zoom drops a matrix outside them.
const mapZoomLimits: ZoomLimits = { minScale: mapScaleMin, maxScale: mapScaleMax };

function stopZoomAnimation(cancelRef: CancelZoomRef) {
  cancelRef.current?.();
  cancelRef.current = null;
}

// Animates from the matrix Zoom last rendered, so a second click (or a Reset) mid-flight
// starts from where the map is. Reduced motion applies the target at once.
function animateZoomTo(
  cancelRef: CancelZoomRef,
  zoom: ZoomHandle | null,
  target: TransformMatrix,
  viewport: Viewport,
) {
  stopZoomAnimation(cancelRef);
  if (!zoom) return;
  cancelRef.current = animateTransform({
    from: zoom.transformMatrix,
    to: target,
    viewport,
    limits: mapZoomLimits,
    durationMs: prefersReducedMotion() ? 0 : countryZoomMs,
    apply: zoom.setTransformMatrix,
  });
}

// Zoom's own wheel handler applies this (and cancels the browser's page zoom).
// React's `onWheel` cannot: React registers wheel listeners as passive.
function mapWheelDelta(event: Pick<WheelEvent, "deltaY">) {
  const next = event.deltaY < 0 ? 1.15 : 1 / 1.15;
  return { scaleX: next, scaleY: next };
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
    const [height, setHeight] = useState(mapHeight);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const isDraggingRef = useRef(false);
    const zoomImperativeRef = useRef<ZoomHandle | null>(null);
    // The cancel function of the last country/Reset animation (a no-op once that animation
    // has finished); null before any animation has started and after a cancel.
    const cancelZoomRef = useRef<(() => void) | null>(null);

    useEffect(() => {
      const node = containerRef.current;
      if (!node) return;
      let isFirstObservation = true;
      let resizeTimer: ReturnType<typeof setTimeout> | null = null;
      const ro = new ResizeObserver((entries) => {
        const rect = entries.at(0)?.contentRect;
        const next = rect?.width;
        const nextHeight = rect?.height;
        if (!next || next <= 0) return;
        const applySize = () => {
          setWidth(next);
          if (nextHeight && nextHeight > 0) setHeight(nextHeight);
        };
        // The first observation fires immediately; later ones are debounced so a CSS
        // width transition does not re-render the SVG every frame.
        if (isFirstObservation) {
          isFirstObservation = false;
          applySize();
          return;
        }
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(applySize, 20);
      });
      ro.observe(node);
      return () => {
        ro.disconnect();
        if (resizeTimer) clearTimeout(resizeTimer);
      };
    }, []);

    // A plain wheel scrolls the page; Ctrl/⌘ + wheel (and a trackpad pinch) zooms.
    // Stopping a plain wheel in the capture phase keeps Zoom's non-passive
    // listener from cancelling the scroll. Any gesture of the user's own (a press,
    // which also starts a drag; a zooming wheel; Safari's pinch) stops a running
    // country zoom, so its later frames cannot overwrite the gesture.
    useEffect(() => {
      const node = containerRef.current;
      if (!node) return;
      const stopAnimation = () => {
        stopZoomAnimation(cancelZoomRef);
      };
      const onWheel = (event: WheelEvent) => {
        if (event.ctrlKey || event.metaKey) stopAnimation();
        else event.stopPropagation();
      };
      node.addEventListener("wheel", onWheel, { capture: true });
      node.addEventListener("pointerdown", stopAnimation, { capture: true });
      node.addEventListener("gesturestart", stopAnimation, { capture: true });
      return () => {
        node.removeEventListener("wheel", onWheel, { capture: true });
        node.removeEventListener("pointerdown", stopAnimation, {
          capture: true,
        });
        node.removeEventListener("gesturestart", stopAnimation, {
          capture: true,
        });
      };
    }, []);

    // A resize changes the viewport the target was fitted to, and an unmount must not
    // leave frames writing to a gone Zoom: both stop the animation (this cleanup runs
    // on each width/height change and on unmount).
    useEffect(
      () => () => {
        stopZoomAnimation(cancelZoomRef);
      },
      [width, height],
    );

    const zoomToBounds = (bounds: Bounds) => {
      onLeaveMap();
      const viewport = { width, height };
      animateZoomTo(
        cancelZoomRef,
        zoomImperativeRef.current,
        fitTransform(bounds, viewport, {
          padding: countryFitPadding,
          ...mapZoomLimits,
        }),
        viewport,
      );
    };

    const stateFeatures: StateFeature[] = stateTopo
      ? extractFeatures(stateTopo, "states")
      : [];
    const countryFeatures: CountryFeature[] = worldTopo
      ? extractFeatures(worldTopo, "countries")
      : [];

    // The parent calls reset() on a view switch: it stays instant, and it stops a running
    // country zoom first so its frames cannot keep writing that country onto the new view.
    // No deps array: zoomToCountry reads the current viewport, view and topology, which a
    // memoized handle would freeze at their first values.
    useImperativeHandle(ref, () => ({
      reset: () => {
        stopZoomAnimation(cancelZoomRef);
        zoomImperativeRef.current?.reset();
      },
      zoomToCountry: (name: string) => {
        if (mapState.view !== "world" || isUsaTopoName(name)) return false;
        const feature = countryFeatures.find(
          (candidate) => featureName(candidate.properties) === name,
        );
        if (!feature) return false;
        const bounds = countryBounds(worldProjection(width, height), feature);
        if (!bounds) return false;
        zoomToBounds(bounds);
        return true;
      },
    }));

    const fips = mapState.selectedStateFips;
    const countyFeatures: CountyFeature[] =
      countyTopo && fips
        ? extractFeatures(countyTopo, "counties").filter(
            (feature) => String(feature.id ?? "").startsWith(fips),
          )
        : [];

    // Antimeridian-crossing counties would make Alaska give a near-global bounding box.
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
              height - countyPadding,
            ],
          ];

    const albersScale = height * 1.55;
    const worldScale = worldMapScale(width, height);

    return (
      <div
        ref={containerRef}
        className="relative flex min-h-131 w-full flex-1 items-center justify-center overflow-hidden rounded-md bg-muted/30"
        onPointerLeave={onLeaveMap}
      >
        <Zoom<SVGSVGElement>
          width={width}
          height={height}
          scaleXMin={mapScaleMin}
          scaleXMax={mapScaleMax}
          scaleYMin={mapScaleMin}
          scaleYMax={mapScaleMax}
          wheelDelta={mapWheelDelta}
        >
          {(zoom) => {
            isDraggingRef.current = zoom.isDragging;
            zoomImperativeRef.current = {
              reset: zoom.reset,
              setTransformMatrix: zoom.setTransformMatrix,
              transformMatrix: zoom.transformMatrix,
            };

            return (
              <>
                <svg
                  width={width}
                  height={height}
                  ref={zoom.containerRef}
                  role="img"
                  aria-label="Genome distribution map"
                  className={cn(
                    "shrink-0 touch-none",
                    zoom.isDragging ? "cursor-grabbing" : "cursor-grab",
                  )}
                >
                  <g transform={zoom.toString()}>
                    {mapState.view === "world" &&
                      (worldTopoLoading ? null : worldTopoError ? null : countryFeatures.length >
                        0 ? (
                        <WorldCountriesLayer
                          countryFeatures={countryFeatures}
                          scale={worldScale}
                          width={width}
                          height={height}
                          data={data}
                          colorScale={colorScale}
                          isDraggingRef={isDraggingRef}
                          onHoverEnter={hoverEnter}
                          onHoverLeave={hoverLeave}
                          onSwitchToUs={onSwitchToUs}
                          onZoomToBounds={zoomToBounds}
                        />
                      ) : null)}

                    {mapState.view === "us" &&
                      !stateTopoError &&
                      stateFeatures.length > 0 && (
                        <UsStatesLayer
                          stateFeatures={stateFeatures}
                          scale={albersScale}
                          width={width}
                          height={height}
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
                      stopZoomAnimation(cancelZoomRef);
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
                      stopZoomAnimation(cancelZoomRef);
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
                      animateZoomTo(cancelZoomRef, zoom, identityMatrix(), {
                        width,
                        height,
                      });
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
