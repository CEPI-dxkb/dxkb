"use client";

import { NaturalEarth } from "@visx/geo";
import type { RefObject } from "react";

import type { OrganismGeoDistribution } from "@/lib/services/organisms/types";

import {
  ChoroplethPath,
  type HoverEnter,
  type HoverLeave,
} from "./choropleth-path";
import {
  isUsaTopoName,
  lookupCountryCount,
  resolveCountryDataKey,
  type ColorScale,
} from "./color-scale";
import { featureName, type CountryFeature } from "./topology-utils";

interface WorldCountriesLayerProps {
  countryFeatures: CountryFeature[];
  scale: number;
  width: number;
  height: number;
  data: OrganismGeoDistribution;
  colorScale: ColorScale;
  isDraggingRef: RefObject<boolean>;
  onHoverEnter: HoverEnter;
  onHoverLeave: HoverLeave;
  onSwitchToUs: () => void;
}

export function WorldCountriesLayer({
  countryFeatures,
  scale,
  width,
  height,
  data,
  colorScale,
  isDraggingRef,
  onHoverEnter,
  onHoverLeave,
  onSwitchToUs,
}: WorldCountriesLayerProps) {
  return (
    <NaturalEarth<CountryFeature>
      data={countryFeatures}
      scale={scale}
      translate={[width / 2, height / 2]}
    >
      {({ features }) =>
        features.map(({ feature, path }) => {
          const name = featureName(feature.properties);
          const count = lookupCountryCount(name, data.countryData);
          const dataKey = resolveCountryDataKey(name, data.countryData) ?? name;
          const meta = data.countryMeta[dataKey] ?? {
            count: 0,
            genera: {},
            hosts: {},
          };
          const interactable = isUsaTopoName(name);
          return (
            <ChoroplethPath
              key={String(feature.id ?? name)}
              pathD={path ?? ""}
              fill={colorScale(count)}
              strokeWidth={0.6}
              cursor={interactable ? "pointer" : "default"}
              isDraggingRef={isDraggingRef}
              payload={{
                view: "world",
                name,
                count,
                genera: meta.genera,
                hosts: meta.hosts,
              }}
              onHoverEnter={onHoverEnter}
              onHoverLeave={onHoverLeave}
              onClick={interactable ? onSwitchToUs : undefined}
            />
          );
        })
      }
    </NaturalEarth>
  );
}
