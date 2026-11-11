"use client";

import dynamic from "next/dynamic";

import { GeoDistributionSkeleton } from "./geo-distribution-skeleton";

/** The Overview map as its own chunk, so only an Overview ships d3-geo and topojson. */
export const LazyGeoDistributionClient = dynamic(
  () =>
    import("./geo-distribution-client").then(
      (module) => module.GeoDistributionClient,
    ),
  { loading: GeoDistributionSkeleton },
);
