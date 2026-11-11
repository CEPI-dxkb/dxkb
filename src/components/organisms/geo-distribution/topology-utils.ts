import * as topojson from "topojson-client";

export interface NamedFeatureProps {
  name?: string;
  NAME?: string;
}

export type StateFeature = GeoJSON.Feature<GeoJSON.Geometry, NamedFeatureProps> & {
  id?: string | number;
};

export type CountyFeature = StateFeature;
export type CountryFeature = StateFeature;

export interface TopologyLike {
  type: "Topology";
  arcs: number[][][];
  objects: Record<string, unknown>;
}

export function featureName(feature: NamedFeatureProps | undefined): string {
  if (!feature) return "";
  return feature.name ?? feature.NAME ?? "";
}

// Features spanning the antimeridian (Alaska's Aleutians West) make
// geoMercator().fitExtent() produce a near-global bounding box.
export function crossesAntimeridian(feature: GeoJSON.Feature): boolean {
  const state = { hasPositive: false, hasVeryNegative: false };
  function scan(coords: unknown): void {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === "number") {
      const lon = coords[0];
      if (lon > 0) state.hasPositive = true;
      if (lon < -160) state.hasVeryNegative = true;
    } else {
      for (const c of coords) scan(c);
    }
  }
  const geom = feature.geometry as GeoJSON.Geometry & { coordinates?: unknown };
  if (geom.coordinates) scan(geom.coordinates);
  return state.hasPositive && state.hasVeryNegative;
}

export function extractFeatures(topo: TopologyLike, objectKey: string): StateFeature[] {
  const object = topo.objects[objectKey];
  if (!object) return [];
  const fc = topojson.feature(topo as never, object as never) as unknown as GeoJSON.FeatureCollection<
    GeoJSON.Geometry,
    NamedFeatureProps
  >;
  return fc.features;
}
