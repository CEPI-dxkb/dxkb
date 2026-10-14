# Geographic Distribution Map: Implementation Guide for React/Next.js

This guide documents how to replicate the interactive choropleth map from the MAAGE-Web Taxonomy Overview page in a React/Next.js project using `@visx/geo`.

The map supports three views:
- **World** — genome counts per country (NaturalEarth projection)
- **United States** — genome counts per state (AlbersUsa projection)
- **State drill-down** — genome counts per county (Mercator + fitExtent)

---

## Table of Contents

1. [Package Installation](#1-package-installation)
2. [Map Data Files](#2-map-data-files)
3. [API Reference — All 8 Calls](#3-api-reference--all-8-calls)
4. [Data Processing Layer](#4-data-processing-layer)
5. [TypeScript Types](#5-typescript-types)
6. [Component Architecture](#6-component-architecture)
7. [Core Components](#7-core-components)
8. [Next.js API Route (Proxy)](#8-nextjs-api-route-proxy)
9. [Known Gotchas](#9-known-gotchas)

---

## 1. Package Installation

```bash
npm install @visx/geo @visx/zoom @visx/scale @visx/event @visx/tooltip topojson-client
npm install -D @types/topojson-client @types/geojson
```

| Package | Purpose |
|---------|---------|
| `@visx/geo` | `NaturalEarth`, `AlbersUsa`, `CustomProjection`, `Graticule` components |
| `@visx/zoom` | `Zoom` component for pan/zoom on all three views |
| `@visx/scale` | `scaleSequential` for the color scale |
| `@visx/tooltip` | `useTooltip`, `TooltipWithBounds` for hover cards |
| `@visx/event` | `localPoint` — translates mouse events to SVG coordinates |
| `topojson-client` | Decodes TopoJSON boundary files into GeoJSON |

---

## 2. Map Data Files

The map uses two TopoJSON files. Copy them from this project or install the npm source packages:

```bash
# Option A — copy from this project
cp public/maage/maps/world-atlas/countries-110m.json  your-project/public/maps/
cp public/maage/maps/us-atlas/counties-10m.json       your-project/public/maps/

# Option B — install npm packages and reference directly
npm install us-atlas world-atlas
```

Place them in `public/maps/` in your Next.js project. They are fetched at runtime as static JSON, not bundled.

| File | Size | Contains |
|------|------|---------|
| `countries-110m.json` | ~100 KB | World country outlines at 1:110m scale |
| `counties-10m.json` | ~900 KB | US state **and** county outlines at 1:10m scale — both under `objects.states` and `objects.counties` in one file |

Fetch both once on mount:

```ts
const [worldTopo, setWorldTopo] = useState(null);
const [usTopo, setUsTopo]       = useState(null);

useEffect(() => {
  Promise.all([
    fetch('/maps/countries-110m.json').then(r => r.json()),
    fetch('/maps/counties-10m.json').then(r => r.json()),
  ]).then(([world, us]) => {
    setWorldTopo(world);
    setUsTopo(us);
  });
}, []);
```

---

## 3. API Reference — All 8 Calls

### Endpoint

```
POST https://p3.theseed.org/services/data_api/genome/
```

### Request Headers

```
Content-Type: application/rqlquery+x-www-form-urlencoded
Accept:       application/solr+json
```

The body is **URL-encoded RQL** (Resource Query Language) sent as a raw string — not JSON. All 8 calls use `limit(0)` so no document rows are returned, only facet aggregations.

The calls below are the ones MAAGE-Web sends, with the taxon wrapped in a genome self-join (`eq(genome_id,*)&genome(...)`). DXKB sends the lineage predicate `eq(taxon_lineage_ids,{TAXON_ID})` on its own (`genomeScopeRql` in `src/lib/services/organisms/genome-scope.ts`). The self-join selects the same genomes: on 2026-10-14 both forms returned the same `numFound` and the same facet and pivot counts for all 8 calls on taxa 2, 234, 286, 1280, 1773, 11320 and 2955291, and the self-join was the slower of the two.

---

### Call 1 — Country genome counts

**Purpose:** Number of genomes per country. Fills the world choropleth.

```
POST body:
eq(genome_id,*)&genome(eq(taxon_lineage_ids,{TAXON_ID}))&facet((field,isolation_country),(mincount,1))&limit(0)
```

**Response shape (relevant part):**

```json
{
  "facet_counts": {
    "facet_fields": {
      "isolation_country": [
        "China",   789,
        "USA",     260,
        "Germany",  45,
        "Iran",     38
      ]
    }
  }
}
```

`isolation_country` is a flat alternating array: `[name, count, name, count, ...]`. Walk it in steps of 2.

---

### Call 2 — Country × genus breakdown (pivot)

**Purpose:** Per-country genus distribution shown in the world-view tooltip.

```
POST body:
eq(genome_id,*)&genome(eq(taxon_lineage_ids,{TAXON_ID}))&facet((pivot,(isolation_country,genus)),(mincount,1))&limit(0)
```

**Response shape:**

```json
{
  "facet_counts": {
    "facet_pivot": {
      "isolation_country,genus": [
        {
          "field": "isolation_country",
          "value": "China",
          "count": 789,
          "pivot": [
            { "field": "genus", "value": "Brucella", "count": 789 }
          ]
        },
        {
          "field": "isolation_country",
          "value": "USA",
          "count": 260,
          "pivot": [
            { "field": "genus", "value": "Brucella",     "count": 250 },
            { "field": "genus", "value": "Ochrobactrum", "count": 10  }
          ]
        }
      ]
    }
  }
}
```

---

### Call 3 — Country × host breakdown (pivot)

**Purpose:** Per-country host distribution shown in the world-view tooltip.

```
POST body:
eq(genome_id,*)&genome(eq(taxon_lineage_ids,{TAXON_ID}))&facet((pivot,(isolation_country,host_common_name)),(mincount,1))&limit(0)
```

Same pivot structure as Call 2, keyed `isolation_country,host_common_name`, with values like `"Cattle"`, `"Sheep"`, `"Human"`.

---

### Call 4 — State/province genome counts

**Purpose:** Number of genomes per US state. Fills the US choropleth.

```
POST body:
eq(genome_id,*)&genome(eq(taxon_lineage_ids,{TAXON_ID}))&facet((field,state_province),(mincount,1))&limit(0)
```

**Response shape:**

```json
{
  "facet_counts": {
    "facet_fields": {
      "state_province": [
        "Texas",      45,
        "California", 32,
        "New York",   28
      ]
    }
  }
}
```

Values are full state names (e.g. `"Texas"`, `"New York"`), matching `feature.properties.name` in the TopoJSON directly.

---

### Call 5 — State × genus breakdown (pivot)

**Purpose:** Per-state genus distribution shown in the US-view tooltip.

```
POST body:
eq(genome_id,*)&genome(eq(taxon_lineage_ids,{TAXON_ID}))&facet((pivot,(state_province,genus)),(mincount,1))&limit(0)
```

Same pivot structure as Call 2, keyed `state_province,genus`.

---

### Call 6 — State × host breakdown (pivot)

**Purpose:** Per-state host distribution shown in the US-view tooltip.

```
POST body:
eq(genome_id,*)&genome(eq(taxon_lineage_ids,{TAXON_ID}))&facet((pivot,(state_province,host_common_name)),(mincount,1))&limit(0)
```

---

### Call 7 — County genome counts

**Purpose:** Number of genomes per county. Fills the state drill-down choropleth.

```
POST body:
eq(genome_id,*)&genome(eq(taxon_lineage_ids,{TAXON_ID}))&facet((field,county),(mincount,1),(limit,1000))&limit(0)
```

> **Note:** `(limit,1000)` is required. The default facet limit is 100, but there are ~3,100 US counties.

**Response shape:**

```json
{
  "facet_counts": {
    "facet_fields": {
      "county": [
        "Los Angeles", 12,
        "Harris",       8,
        "Cook",         5
      ]
    }
  }
}
```

County values are bare names without the "County" suffix (e.g. `"Los Angeles"` not `"Los Angeles County"`). The TopoJSON `feature.properties.name` matches this format.

---

### Call 8 — County × genus breakdown (pivot)

**Purpose:** Per-county genus distribution shown in the county drill-down tooltip.

```
POST body:
eq(genome_id,*)&genome(eq(taxon_lineage_ids,{TAXON_ID}))&facet((pivot,(county,genus)),(mincount,1),(limit,1000))&limit(0)
```

---

### Making all 8 calls together

```ts
async function fetchMapData(taxonId: string): Promise<RawMapData> {
  const base     = `eq(genome_id,*)&genome(eq(taxon_lineage_ids,${taxonId}))`;
  const endpoint = 'https://p3.theseed.org/services/data_api/genome/';
  const headers  = {
    'Content-Type': 'application/rqlquery+x-www-form-urlencoded',
    'Accept':       'application/solr+json',
  };

  const queries = [
    `${base}&facet((field,isolation_country),(mincount,1))&limit(0)`,
    `${base}&facet((pivot,(isolation_country,genus)),(mincount,1))&limit(0)`,
    `${base}&facet((pivot,(isolation_country,host_common_name)),(mincount,1))&limit(0)`,
    `${base}&facet((field,state_province),(mincount,1))&limit(0)`,
    `${base}&facet((pivot,(state_province,genus)),(mincount,1))&limit(0)`,
    `${base}&facet((pivot,(state_province,host_common_name)),(mincount,1))&limit(0)`,
    `${base}&facet((field,county),(mincount,1),(limit,1000))&limit(0)`,
    `${base}&facet((pivot,(county,genus)),(mincount,1),(limit,1000))&limit(0)`,
  ];

  const results = await Promise.all(
    queries.map(body => fetch(endpoint, { method: 'POST', headers, body }).then(r => r.json()))
  );

  return {
    countryRes:      results[0],
    countryPivotRes: results[1],
    countryHostRes:  results[2],
    stateRes:        results[3],
    statePivotRes:   results[4],
    stateHostRes:    results[5],
    countyRes:       results[6],
    countyPivotRes:  results[7],
  };
}
```

---

## 4. Data Processing Layer

Transform raw API responses into a normalized `MapData` object consumed by the map components.

```ts
function parseFacetField(res: SolrResponse, field: string): Record<string, number> {
  const facets: Array<string | number> =
    res?.facet_counts?.facet_fields?.[field] ?? [];
  const out: Record<string, number> = {};
  for (let i = 0; i < facets.length; i += 2) {
    const name  = facets[i] as string;
    const count = facets[i + 1] as number;
    if (name && count > 0) out[name] = count;
  }
  return out;
}

function parsePivot(
  res: SolrResponse,
  pivotKey: string  // e.g. "isolation_country,genus"
): Record<string, Record<string, number>> {
  const pivots: PivotItem[] =
    res?.facet_counts?.facet_pivot?.[pivotKey] ?? [];
  const out: Record<string, Record<string, number>> = {};
  for (const item of pivots) {
    out[item.value] = {};
    for (const sub of item.pivot ?? []) {
      out[item.value][sub.value] = sub.count;
    }
  }
  return out;
}

export function processMapData(raw: RawMapData): MapData {
  const countryData  = parseFacetField(raw.countryRes,  'isolation_country');
  const countryGenus = parsePivot(raw.countryPivotRes,  'isolation_country,genus');
  const countryHosts = parsePivot(raw.countryHostRes,   'isolation_country,host_common_name');
  const stateData    = parseFacetField(raw.stateRes,    'state_province');
  const stateGenus   = parsePivot(raw.statePivotRes,    'state_province,genus');
  const stateHosts   = parsePivot(raw.stateHostRes,     'state_province,host_common_name');
  const countyData   = parseFacetField(raw.countyRes,   'county');
  const countyGenus  = parsePivot(raw.countyPivotRes,   'county,genus');

  const buildMeta = (
    counts: Record<string, number>,
    genera: Record<string, Record<string, number>>,
    hosts?: Record<string, Record<string, number>>
  ): Record<string, LocationMeta> => {
    const meta: Record<string, LocationMeta> = {};
    for (const name of Object.keys(counts)) {
      meta[name] = {
        count:  counts[name],
        genera: genera[name] ?? {},
        hosts:  hosts?.[name] ?? {},
      };
    }
    return meta;
  };

  return {
    countryData,
    countryMeta: buildMeta(countryData, countryGenus, countryHosts),
    stateData,
    stateMeta:   buildMeta(stateData,   stateGenus,   stateHosts),
    countyData,
    countyMeta:  buildMeta(countyData,  countyGenus),
    maxCount: Math.max(
      ...Object.values(countryData),
      ...Object.values(stateData),
      ...Object.values(countyData),
      0
    ),
  };
}
```

---

## 5. TypeScript Types

```ts
// API response types
interface PivotItem {
  field:  string;
  value:  string;
  count:  number;
  pivot?: PivotItem[];
}

interface SolrResponse {
  facet_counts?: {
    facet_fields?: Record<string, Array<string | number>>;
    facet_pivot?:  Record<string, PivotItem[]>;
  };
}

interface RawMapData {
  countryRes:      SolrResponse;
  countryPivotRes: SolrResponse;
  countryHostRes:  SolrResponse;
  stateRes:        SolrResponse;
  statePivotRes:   SolrResponse;
  stateHostRes:    SolrResponse;
  countyRes:       SolrResponse;
  countyPivotRes:  SolrResponse;
}

// Processed data
interface LocationMeta {
  count:  number;
  genera: Record<string, number>;
  hosts:  Record<string, number>;
}

interface MapData {
  countryData: Record<string, number>;
  countryMeta: Record<string, LocationMeta>;
  stateData:   Record<string, number>;
  stateMeta:   Record<string, LocationMeta>;
  countyData:  Record<string, number>;
  countyMeta:  Record<string, LocationMeta>;
  maxCount:    number;
}

// View state
type MapView = 'world' | 'us' | 'state';

interface MapState {
  view:          MapView;
  selectedState: string | null;  // FIPS code, e.g. "17"
  stateName:     string | null;  // e.g. "Illinois"
}
```

---

## 6. Component Architecture

```
<GeoDistributionMap taxonId="234">
  │
  ├── fetchMapData()           ← 8 parallel POST requests
  ├── fetch('/maps/...')       ← 2 TopoJSON files
  │
  ├── <MapControls>            ← World / United States / State buttons
  │     ├── view toggle buttons
  │     ├── state dropdown (visible in state view)
  │     └── zoom +/−/⟲ buttons
  │
  └── <ChoroplethMap>          ← SVG map, switches projection by view
        ├── <Zoom>             ← @visx/zoom handles pan and zoom
        │     ├── <NaturalEarth>        (world view)
        │     ├── <AlbersUsa>           (US states view)
        │     └── <CustomProjection>    (county drill-down)
        └── <TooltipWithBounds>
```

---

## 7. Core Components

### Color scale

Uses a log₁₀ transform so that small counts still get meaningful color differentiation across the full range:

```ts
import { interpolateRgb } from 'd3-interpolate';

function makeColorScale(maxCount: number) {
  const logMax = Math.log10(maxCount + 1);
  return (count: number): string => {
    if (count === 0) return '#f8f9fa';
    const t = Math.log10(count + 1) / logMax;
    return interpolateRgb('#f0f9f0', '#2d6a4f')(t);
  };
}
```

### Country name normalization

The TopoJSON uses names like `"United States of America"` while the API returns `"USA"` or `"United States"`. Copy the `countryNameMapping` table from `public/js/p3/widget/D3Choropleth.js` (lines 54–118) — it covers the ~40 countries with mismatches. Apply it in a lookup helper:

```ts
function lookupCountry(
  topoName: string,
  countryData: Record<string, number>,
  nameMapping: Record<string, string[]>
): number {
  if (countryData[topoName]) return countryData[topoName];

  const aliases = nameMapping[topoName];
  if (aliases) {
    for (const alias of aliases) {
      if (countryData[alias]) return countryData[alias];
    }
  }

  // Normalized fallback
  const norm = topoName.toLowerCase().replace(/[^a-z]/g, '');
  for (const [key, count] of Object.entries(countryData)) {
    if (key.toLowerCase().replace(/[^a-z]/g, '') === norm) return count;
  }

  return 0;
}
```

### Main component

```tsx
'use client'; // Next.js app router

import { useState, useEffect, useCallback, useRef } from 'react';
import { NaturalEarth, AlbersUsa, CustomProjection } from '@visx/geo';
import { Zoom } from '@visx/zoom';
import { useTooltip, TooltipWithBounds } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import * as topojson from 'topojson-client';
import { geoMercator } from 'd3-geo';

export function GeoDistributionMap({ taxonId }: { taxonId: string }) {
  const [mapData,   setMapData]   = useState<MapData | null>(null);
  const [worldTopo, setWorldTopo] = useState<any>(null);
  const [usTopo,    setUsTopo]    = useState<any>(null);
  const [mapState,  setMapState]  = useState<MapState>({
    view: 'us', selectedState: null, stateName: null,
  });
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 450 });

  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen,
          showTooltip, hideTooltip } = useTooltip<LocationMeta & { name: string }>();

  // Load TopoJSON and API data in parallel
  useEffect(() => {
    Promise.all([
      fetch('/maps/countries-110m.json').then(r => r.json()),
      fetch('/maps/counties-10m.json').then(r => r.json()),
      fetchMapData(taxonId).then(processMapData),
    ]).then(([world, us, data]) => {
      setWorldTopo(world);
      setUsTopo(us);
      setMapData(data);
      setLoading(false);
    });
  }, [taxonId]);

  // Resize observer — map fills its container
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height: Math.max(height, 350) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const colorScale = mapData ? makeColorScale(mapData.maxCount) : () => '#f8f9fa';

  // Derive GeoJSON features from TopoJSON
  const worldFeatures = worldTopo
    ? topojson.feature(worldTopo, worldTopo.objects.countries).features
    : [];
  const stateFeatures = usTopo
    ? topojson.feature(usTopo, usTopo.objects.states).features
    : [];
  const countyFeatures = usTopo && mapState.selectedState
    ? topojson.feature(usTopo, usTopo.objects.counties).features
        .filter(f => String(f.id).startsWith(mapState.selectedState!))
    : [];

  // County projection — fit selected state bounds dynamically
  const countyProjection = useCallback(() => {
    if (!countyFeatures.length) return geoMercator();
    const bounds = { type: 'FeatureCollection', features: countyFeatures } as GeoJSON.FeatureCollection;
    const padding = 20;
    return geoMercator().fitExtent(
      [[padding, padding], [dims.width - padding, dims.height - padding]],
      bounds
    );
  }, [countyFeatures, dims]);

  return (
    <div className="relative w-full h-[450px]" ref={containerRef}>
      <MapControls mapState={mapState} onViewChange={setMapState} />

      {loading && <LoadingOverlay />}

      <Zoom<SVGSVGElement>
        width={dims.width}
        height={dims.height}
        scaleXMin={0.5} scaleXMax={8}
        scaleYMin={0.5} scaleYMax={8}
      >
        {zoom => (
          <svg
            width={dims.width}
            height={dims.height}
            ref={zoom.containerRef}
            onMouseDown={zoom.dragStart}
            onMouseMove={zoom.dragMove}
            onMouseUp={zoom.dragEnd}
            onMouseLeave={() => { zoom.dragEnd(); hideTooltip(); }}
            style={{ cursor: zoom.isDragging ? 'grabbing' : 'grab' }}
          >
            <rect width={dims.width} height={dims.height} fill="#f0f4f8" />
            <g transform={zoom.toString()}>

              {mapState.view === 'world' && (
                <NaturalEarth
                  data={worldFeatures}
                  scale={150}
                  translate={[dims.width / 2, dims.height / 2]}
                >
                  {({ features, path }) =>
                    features.map(({ feature, path: fPath }, i) => {
                      const name  = feature.properties?.NAME ?? '';
                      const count = mapData
                        ? lookupCountry(name, mapData.countryData, countryNameMapping)
                        : 0;
                      return (
                        <path
                          key={i}
                          d={fPath ?? ''}
                          fill={colorScale(count)}
                          stroke="#334155"
                          strokeWidth={0.5}
                          style={{ cursor: 'pointer' }}
                          onMouseMove={e => {
                            const pt = localPoint(e);
                            showTooltip({
                              tooltipData: { name, ...mapData?.countryMeta[name] },
                              tooltipLeft: pt?.x,
                              tooltipTop:  pt?.y,
                            });
                          }}
                          onMouseLeave={hideTooltip}
                          onClick={() => {
                            const usaNames = ['United States of America', 'United States', 'USA'];
                            if (usaNames.includes(name)) {
                              setMapState({ view: 'us', selectedState: null, stateName: null });
                            }
                          }}
                        />
                      );
                    })
                  }
                </NaturalEarth>
              )}

              {mapState.view === 'us' && (
                <AlbersUsa
                  data={stateFeatures}
                  scale={1000}
                  translate={[dims.width / 2, dims.height / 2]}
                >
                  {({ features }) =>
                    features.map(({ feature, path: fPath }, i) => {
                      const name  = feature.properties?.name ?? '';
                      const count = mapData?.stateData[name] ?? 0;
                      return (
                        <path
                          key={i}
                          d={fPath ?? ''}
                          fill={colorScale(count)}
                          stroke="#334155"
                          strokeWidth={0.5}
                          style={{ cursor: 'pointer' }}
                          onMouseMove={e => {
                            const pt = localPoint(e);
                            showTooltip({
                              tooltipData: { name, ...mapData?.stateMeta[name] },
                              tooltipLeft: pt?.x,
                              tooltipTop:  pt?.y,
                            });
                          }}
                          onMouseLeave={hideTooltip}
                          onClick={() => {
                            const fips = String(feature.id).padStart(2, '0');
                            setMapState({ view: 'state', selectedState: fips, stateName: name });
                          }}
                        />
                      );
                    })
                  }
                </AlbersUsa>
              )}

              {mapState.view === 'state' && countyFeatures.length > 0 && (
                <CustomProjection
                  data={countyFeatures}
                  projection={countyProjection}
                >
                  {({ features }) =>
                    features.map(({ feature, path: fPath }, i) => {
                      const name  = feature.properties?.name ?? '';
                      const count = mapData?.countyData[name] ?? 0;
                      return (
                        <path
                          key={i}
                          d={fPath ?? ''}
                          fill={colorScale(count)}
                          stroke="#334155"
                          strokeWidth={0.5}
                          onMouseMove={e => {
                            const pt = localPoint(e);
                            showTooltip({
                              tooltipData: { name, ...mapData?.countyMeta[name] },
                              tooltipLeft: pt?.x,
                              tooltipTop:  pt?.y,
                            });
                          }}
                          onMouseLeave={hideTooltip}
                        />
                      );
                    })
                  }
                </CustomProjection>
              )}

            </g>
          </svg>
        )}
      </Zoom>

      {tooltipOpen && tooltipData && (
        <TooltipWithBounds left={tooltipLeft} top={tooltipTop}>
          <MapTooltip data={tooltipData} />
        </TooltipWithBounds>
      )}
    </div>
  );
}
```

### Tooltip content component

```tsx
function MapTooltip({ data }: { data: LocationMeta & { name: string } }) {
  const total     = data.count ?? 0;
  const topGenera = Object.entries(data.genera ?? {})
    .sort(([, a], [, b]) => b - a).slice(0, 5);
  const topHosts  = Object.entries(data.hosts ?? {})
    .sort(([, a], [, b]) => b - a).slice(0, 5);

  return (
    <div className="text-sm min-w-[160px]">
      <div className="font-bold mb-1">{data.name}</div>
      <div>Genomes: {total}</div>
      {topGenera.length > 0 && (
        <div className="mt-2 border-t border-white/20 pt-2">
          <div className="font-semibold mb-1">Top Genera</div>
          {topGenera.map(([genus, count]) => (
            <div key={genus}>
              <em>{genus}</em>: {count} ({Math.round((count / total) * 100)}%)
            </div>
          ))}
        </div>
      )}
      {topHosts.length > 0 && (
        <div className="mt-2 border-t border-white/20 pt-2">
          <div className="font-semibold mb-1">Top Hosts</div>
          {topHosts.map(([host, count]) => (
            <div key={host}>
              {host}: {count} ({Math.round((count / total) * 100)}%)
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 8. Next.js API Route (Proxy)

The BV-BRC API allows `localhost:3000` via CORS but may block your production domain. Proxy the requests server-side with a Next.js Route Handler:

```ts
// app/api/genome-map/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.text();

  const upstream = await fetch('https://p3.theseed.org/services/data_api/genome/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/rqlquery+x-www-form-urlencoded',
      'Accept':       'application/solr+json',
    },
    body,
  });

  const data = await upstream.json();
  return NextResponse.json(data);
}
```

Then update `fetchMapData` to use the proxy:

```ts
// Before (direct, works from localhost):
const endpoint = 'https://p3.theseed.org/services/data_api/genome/';

// After (proxied, works in production):
const endpoint = '/api/genome-map';
```

---

## 9. Known Gotchas

### County name matching

County names in the API (`"Los Angeles"`) and in the TopoJSON (`feature.properties.name`) are bare names without "County". They match directly for most counties, but watch for edge cases like `"St. Louis"` vs `"St Louis"`. Apply the same normalize-and-compare pattern used for countries:

```ts
const norm = name.toLowerCase().replace(/[^a-z]/g, '');
```

### `<CustomProjection>` and memoization

The `projection` prop accepts a factory function. If you pass an inline arrow function, it recreates the projection on every render and causes the map to flicker. Wrap it in `useCallback` with `[countyFeatures, dims]` as dependencies, as shown in the main component above.

### `<AlbersUsa>` clips Alaska and Hawaii

The AlbersUsa projection repositions Alaska and Hawaii to the bottom-left inset. County FIPS codes starting with `"02"` (Alaska) and `"15"` (Hawaii) are included in `counties-10m.json` and render in their repositioned positions automatically when you filter by state.

### `@visx/zoom` and SVG refs

Pass `zoom.containerRef` to the `<svg>` element, **not** a wrapper `<div>`. The zoom behavior attaches wheel and pointer events directly to the SVG element.

### `limit(0)` is required

Without it the API returns the first 25 genome document rows along with facets, which bloats each response by ~50 KB. With `limit(0)` you get only `facet_counts`, which is all the map needs.

### State FIPS code padding

`feature.id` in the US TopoJSON is a numeric FIPS code (e.g. `17` for Illinois). County FIPS codes start with the two-digit state prefix. Always pad with `String(feature.id).padStart(2, '0')` before using it as a `startsWith` filter on counties.

### Color scale — use the log transform

The genome count range is typically 1–800+. A linear scale compresses nearly everything to the lightest color. The log₁₀ transform in `makeColorScale` gives meaningful color differentiation across orders of magnitude. Without it the choropleth looks nearly monochrome.

### Country name mapping table

Copy the `countryNameMapping` object from `public/js/p3/widget/D3Choropleth.js` lines 54–118 into your project. It maps TopoJSON names (e.g. `"United States of America"`) to their API equivalents (e.g. `["USA", "United States", "US"]`) for the ~40 countries that don't match directly.
