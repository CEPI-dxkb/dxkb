"use client";

import dynamic from "next/dynamic";

import { GeoDistributionSkeleton } from "./geo-distribution-skeleton";

/**
 * The Overview map as its own chunk (SSR on), so only an Overview ships d3-geo
 * and topojson; see docs/architecture.md, "Views & organism landing".
 */
export const LazyGeoDistributionClient = dynamic(
  () =>
    import("./geo-distribution-client").then(
      (module) => module.GeoDistributionClient,
    ),
  { loading: GeoDistributionSkeleton },
);
