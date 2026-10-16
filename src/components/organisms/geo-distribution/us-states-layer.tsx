"use client";

import { AlbersUsa } from "@visx/geo";
import type { RefObject } from "react";

import type { OrganismGeoDistribution } from "@/lib/services/organisms/types";

import {
  ChoroplethPath,
  type HoverEnter,
  type HoverLeave,
} from "./choropleth-path";
import type { ColorScale } from "./color-scale";
import { featureName, type StateFeature } from "./topology-utils";

interface UsStatesLayerProps {
  stateFeatures: StateFeature[];
  scale: number;
  width: number;
  height: number;
  data: OrganismGeoDistribution;
  colorScale: ColorScale;
  isDraggingRef: RefObject<boolean>;
  onHoverEnter: HoverEnter;
  onHoverLeave: HoverLeave;
  onSelectState: (fips: string, name: string) => void;
}

export function UsStatesLayer({
  stateFeatures,
  scale,
  width,
  height,
  data,
  colorScale,
  isDraggingRef,
  onHoverEnter,
  onHoverLeave,
  onSelectState,
}: UsStatesLayerProps) {
  return (
    <AlbersUsa<StateFeature>
      data={stateFeatures}
      scale={scale}
      translate={[width / 2, height / 2]}
    >
      {({ features }) =>
        features.map(({ feature, path }) => {
          const name = featureName(feature.properties);
          const count = data.stateData[name] ?? 0;
          const meta = data.stateMeta[name] ?? {
            count: 0,
            genera: {},
            hosts: {},
          };
          return (
            <ChoroplethPath
              key={String(feature.id ?? name)}
              pathD={path ?? ""}
              fill={colorScale(count)}
              strokeWidth={0.75}
              cursor="pointer"
              isDraggingRef={isDraggingRef}
              payload={{
                view: "us",
                name,
                count,
                genera: meta.genera,
                hosts: meta.hosts,
              }}
              onHoverEnter={onHoverEnter}
              onHoverLeave={onHoverLeave}
              onClick={() => {
                const fips = String(feature.id ?? "").padStart(2, "0");
                if (fips) onSelectState(fips, name);
              }}
            />
          );
        })
      }
    </AlbersUsa>
  );
}
