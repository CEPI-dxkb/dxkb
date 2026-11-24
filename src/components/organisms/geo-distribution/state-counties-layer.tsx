"use client";

import { CustomProjection } from "@visx/geo";
import { geoMercator } from "@visx/vendor/d3-geo";
import { useEffect, type RefObject } from "react";

import type { OrganismGeoDistribution } from "@/lib/services/organisms/types";

import {
  ChoroplethPath,
  type HoverEnter,
  type HoverLeave,
} from "./choropleth-path";
import type { ColorScale } from "./color-scale";
import {
  countyDataKey,
  featureName,
  unmatchedCountyNames,
  warnUnmatchedCounties,
  type CountyFeature,
} from "./topology-utils";

interface StateCountiesLayerProps {
  countyFeatures: CountyFeature[];
  fitBoundsFeatures: CountyFeature[];
  fitExtent: [[number, number], [number, number]];
  data: OrganismGeoDistribution;
  colorScale: ColorScale;
  isDraggingRef: RefObject<boolean>;
  onHoverEnter: HoverEnter;
  onHoverLeave: HoverLeave;
  selectedStateName: string | null;
}

export function StateCountiesLayer({
  countyFeatures,
  fitBoundsFeatures,
  fitExtent,
  data,
  colorScale,
  isDraggingRef,
  onHoverEnter,
  onHoverLeave,
  selectedStateName,
}: StateCountiesLayerProps) {
  useEffect(() => {
    if (!selectedStateName) return;
    warnUnmatchedCounties(
      selectedStateName,
      unmatchedCountyNames(
        data.countyData,
        selectedStateName,
        countyFeatures.map((feature) => featureName(feature.properties)),
      ),
    );
  }, [countyFeatures, data.countyData, selectedStateName]);

  const projection = () => geoMercator();

  return (
    <CustomProjection<CountyFeature>
      data={countyFeatures}
      projection={projection}
      fitExtent={[
        fitExtent,
        { type: "FeatureCollection", features: fitBoundsFeatures } as never,
      ]}
    >
      {({ features }) =>
        features.map(({ feature, path }) => {
          const name = featureName(feature.properties);
          const key = countyDataKey(selectedStateName, name);
          const count = data.countyData[key] ?? 0;
          const meta = data.countyMeta[key] ?? {
            count: 0,
            genera: {},
            hosts: {},
          };
          return (
            <ChoroplethPath
              key={String(feature.id ?? key)}
              pathD={path ?? ""}
              fill={colorScale(count)}
              strokeWidth={1}
              isDraggingRef={isDraggingRef}
              payload={{
                view: "state",
                name,
                count,
                genera: meta.genera,
                hosts: meta.hosts,
              }}
              onHoverEnter={onHoverEnter}
              onHoverLeave={onHoverLeave}
            />
          );
        })
      }
    </CustomProjection>
  );
}
