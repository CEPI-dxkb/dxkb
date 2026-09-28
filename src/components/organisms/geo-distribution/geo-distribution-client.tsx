"use client";

import { TooltipWithBounds, useTooltip } from "@visx/tooltip";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import * as topojson from "topojson-client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { OrganismGeoDistribution } from "@/lib/services/organisms/types";

import {
  ChoroplethSvg,
  type ChoroplethHandle,
  type HoverPayload,
} from "./choropleth-svg";
import { ColorLegend } from "./color-legend";
import { makeColorScale } from "./color-scale";
import { MapControls } from "./map-controls";
import { MapTooltip } from "./map-tooltip";
import type { GeoDistributionAccent, GeoMapState, GeoMapView } from "./types";

interface GeoDistributionClientProps {
  data: OrganismGeoDistribution;
  accent: GeoDistributionAccent;
}

interface TopologyLike {
  type: "Topology";
  arcs: number[][][];
  objects: Record<string, unknown>;
}

const tooltipOffset = 14;

async function fetchTopoJson(url: string): Promise<TopologyLike> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${String(response.status)}`);
  return (await response.json()) as TopologyLike;
}

export function GeoDistributionClient({
  data,
  accent,
}: GeoDistributionClientProps) {
  const [mapState, setMapState] = useState<GeoMapState>({
    view: Object.values(data.stateData).some((count) => count > 0)
      ? "us"
      : "world",
    selectedStateFips: null,
    selectedStateName: null,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const choroplethRef = useRef<ChoroplethHandle>(null);

  // States-only TopoJSON loads on mount for the default US view. The full
  // counties topology is much larger (~842 KB) and is only fetched when the
  // user drills into a state.
  const statesQuery = useQuery({
    queryKey: ["geo-distribution", "states-topo"],
    queryFn: () => fetchTopoJson("/maps/states-10m.json"),
    enabled: mapState.view === "us" || mapState.view === "state",
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const countiesQuery = useQuery({
    queryKey: ["geo-distribution", "counties-topo"],
    queryFn: () => fetchTopoJson("/maps/counties-10m.json"),
    enabled: mapState.view === "state",
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const worldQuery = useQuery({
    queryKey: ["geo-distribution", "world-topo"],
    queryFn: () => fetchTopoJson("/maps/countries-110m.json"),
    enabled: mapState.view === "world",
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const stateTopo = statesQuery.data ?? null;
  const countyTopo = countiesQuery.data ?? null;
  const worldTopo = worldQuery.data ?? null;
  const stateTopoError = statesQuery.error
    ? statesQuery.error instanceof Error
      ? statesQuery.error.message
      : String(statesQuery.error)
    : null;
  const countyTopoError = countiesQuery.error
    ? countiesQuery.error instanceof Error
      ? countiesQuery.error.message
      : String(countiesQuery.error)
    : null;
  const worldTopoError = worldQuery.error
    ? worldQuery.error instanceof Error
      ? worldQuery.error.message
      : String(worldQuery.error)
    : null;

  const stateOptions: { fips: string; name: string }[] = [];
  const statesObject = stateTopo?.objects.states;
  if (stateTopo && statesObject) {
    const collection = topojson.feature(
      stateTopo as never,
      statesObject as never,
    ) as unknown as GeoJSON.FeatureCollection<
      GeoJSON.Geometry,
      { name?: string }
    >;
    for (const feature of collection.features) {
      const fips = String(
        (feature as { id?: string | number }).id ?? "",
      ).padStart(2, "0");
      const name = feature.properties.name ?? "";
      if (fips && name) stateOptions.push({ fips, name });
    }
    stateOptions.sort((a, b) => a.name.localeCompare(b.name));
  }

  const colorScale = makeColorScale(data.maxCount, accent);

  const {
    tooltipOpen,
    tooltipLeft,
    tooltipTop,
    tooltipData,
    showTooltip,
    hideTooltip,
  } = useTooltip<HoverPayload>();

  const handleViewChange = (view: GeoMapView) => {
    setMapState((prev) => {
      if (view === "us") {
        return { view: "us", selectedStateFips: null, selectedStateName: null };
      }
      if (view === "world") {
        return {
          view: "world",
          selectedStateFips: null,
          selectedStateName: null,
        };
      }
      // view === "state" — default to Illinois if no state is already selected
      if (prev.selectedStateFips) return { ...prev, view: "state" };
      return {
        view: "state",
        selectedStateFips: "17",
        selectedStateName: "Illinois",
      };
    });
    hideTooltip();
    choroplethRef.current?.reset();
  };

  const handleSelectState = (fips: string, name: string) => {
    setMapState({
      view: "state",
      selectedStateFips: fips,
      selectedStateName: name,
    });
    hideTooltip();
    choroplethRef.current?.reset();
  };

  const handleHoverChange = (
    payload: HoverPayload | null,
    event: ReactPointerEvent<SVGPathElement>,
  ) => {
    if (!payload) {
      hideTooltip();
      return;
    }
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const left = event.clientX - rect.left + tooltipOffset;
    const top = event.clientY - rect.top + tooltipOffset;
    showTooltip({ tooltipData: payload, tooltipLeft: left, tooltipTop: top });
  };

  let helperMessage: string | null = null;
  if (mapState.view === "world" && Object.keys(data.countryData).length === 0) {
    helperMessage = "No country-level data for this taxon.";
  } else if (
    mapState.view === "us" &&
    Object.keys(data.stateData).length === 0
  ) {
    helperMessage = "No US state-level data for this taxon.";
  } else if (
    mapState.view === "state" &&
    mapState.selectedStateFips &&
    Object.keys(data.countyData).length === 0
  ) {
    helperMessage = "No county-level data for this taxon.";
  }

  return (
    <Card variant="panel" className="h-full" size="sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <h2 className="text-lg leading-snug font-medium">
          Geographic Distribution
        </h2>
        <MapControls
          mapState={mapState}
          stateOptions={stateOptions}
          onViewChange={handleViewChange}
          onSelectState={handleSelectState}
        />
      </CardHeader>
      <CardContent className="relative">
        <div ref={containerRef} className="relative">
          <ChoroplethSvg
            ref={choroplethRef}
            data={data}
            colorScale={colorScale}
            mapState={mapState}
            onSelectState={handleSelectState}
            onSwitchToUs={() => {
              handleViewChange("us");
            }}
            worldTopo={worldTopo}
            worldTopoLoading={worldQuery.isLoading}
            worldTopoError={worldTopoError}
            stateTopo={stateTopo}
            stateTopoError={stateTopoError}
            countyTopo={countyTopo}
            countyTopoLoading={countiesQuery.isLoading}
            countyTopoError={countyTopoError}
            onHoverChange={handleHoverChange}
            onLeaveMap={hideTooltip}
          />
          {tooltipOpen && tooltipData && (
            <TooltipWithBounds
              left={tooltipLeft}
              top={tooltipTop}
              unstyled
              className="pointer-events-none absolute z-10 rounded-md border bg-popover p-2 text-popover-foreground shadow-md"
            >
              <MapTooltip data={tooltipData} />
            </TooltipWithBounds>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{helperMessage}</span>
          <ColorLegend maxCount={data.maxCount} accent={accent} />
        </div>
      </CardContent>
    </Card>
  );
}
