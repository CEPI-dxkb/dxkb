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

/** The key `countyData` and `countyMeta` use for a county: the state is part of it because county names repeat across states. */
export function countyDataKey(
  stateName: string | null,
  countyName: string,
): string {
  return stateName ? `${stateName}|${countyName}` : countyName;
}

/** The counties `countyData` holds for a state that no map county is called, which therefore draw grey. */
export function unmatchedCountyNames(
  countyData: Record<string, number>,
  stateName: string,
  mapCountyNames: readonly string[],
): string[] {
  const prefix = `${stateName}|`;
  const known = new Set(mapCountyNames);
  return Object.keys(countyData)
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length))
    .filter((name) => !known.has(name));
}

const warnedUnmatchedCounties = new Set<string>();

/** One warning per distinct (state, names) for the page's lifetime: the layer re-renders on every hover. */
export function warnUnmatchedCounties(
  stateName: string,
  names: readonly string[],
): void {
  if (names.length === 0) return;
  const signature = `${stateName}|${names.join("|")}`;
  if (warnedUnmatchedCounties.has(signature)) return;
  warnedUnmatchedCounties.add(signature);
  console.warn(
    `[geo-distribution] county names in ${stateName} match no county on the map and draw grey (${String(names.length)}): ${names.join(", ")}`,
  );
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
