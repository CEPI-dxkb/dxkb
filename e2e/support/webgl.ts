import type { Page } from "@playwright/test";

/**
 * Auspice's MapLibre map needs WebGL; headless Firefox in the Linux CI
 * container has none, so Auspice drops the map panel.
 */
export async function hasWebGl(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.createElement("canvas").getContext("webgl") !== null,
  );
}
