import type { Page } from "@playwright/test";

/**
 * Whether the browser can create a WebGL context. Auspice 3 draws its map with
 * MapLibre, which needs WebGL; without it Auspice renders the tree and drops
 * the map panel. Headless Firefox in the Linux CI container has no WebGL.
 */
export async function hasWebGl(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.createElement("canvas").getContext("webgl") !== null,
  );
}
