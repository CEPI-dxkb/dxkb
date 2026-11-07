import type { Page } from "@playwright/test";

// Auspice 3 draws its map with MapLibre from the OpenFreeMap style bundled in
// node_modules/auspice/src/util/map-styles.json (auspice/config.json sets no
// `mapTiles`). Every resource that style names lives on one host: the TileJSON
// (`/planet`), vector tiles and glyph ranges (`.pbf`), and the sprite sheet
// (`.json` + `.png`). Serve them empty so specs never reach the live host.
// MapLibre fetches all of them with CORS, so each stub allows the origin as
// OpenFreeMap does, or the request fails before it is drawn.

const cors = { "access-control-allow-origin": "*" };
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X2NDNwAAAABJRU5ErkJggg==",
  "base64",
);

/** The attribution OpenFreeMap's TileJSON carries; the map shows it once the style loads. */
export const auspiceBasemapAttribution =
  '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';

export async function mockAuspiceBasemap(page: Page): Promise<void> {
  await page.route(/^https:\/\/tiles\.openfreemap\.org\//, (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/planet") {
      return route.fulfill({
        headers: cors,
        json: {
          tilejson: "3.0.0",
          tiles: ["https://tiles.openfreemap.org/planet/e2e/{z}/{x}/{y}.pbf"],
          minzoom: 0,
          maxzoom: 14,
          attribution: auspiceBasemapAttribution,
        },
      });
    }
    if (pathname.endsWith(".json")) return route.fulfill({ headers: cors, json: {} });
    if (pathname.endsWith(".png")) {
      return route.fulfill({ headers: cors, contentType: "image/png", body: pixel });
    }
    // A zero-length protobuf is a valid tile (or glyph range) with no layers.
    return route.fulfill({
      headers: cors,
      contentType: "application/x-protobuf",
      body: Buffer.alloc(0),
    });
  });
}
