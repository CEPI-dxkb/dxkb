import type { Locator, Page } from "@playwright/test";

import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  emptyBackendFallbackOverrides,
  noCountyTaxonId,
  workspaceOverrides,
} from "../fixtures/overrides";

test.use({ storageState: { cookies: [], origins: [] } });

// Zoom serializes the matrix with a space after each comma.
const identityTransform = /^matrix\(1,\s*0,\s*0,\s*1,\s*0,\s*0\)$/;

// The map group's `transform` is `matrix(k,0,0,k,tx,ty)`: `k` is the zoom scale and
// `tx`, `ty` the pan.
function matrixOf(transform: string | null) {
  const match = /^matrix\(([^)]+)\)$/.exec(transform ?? "");
  if (!match) return { scale: Number.NaN, translateX: Number.NaN, translateY: Number.NaN };
  const [scale = Number.NaN, , , , translateX = Number.NaN, translateY = Number.NaN] = match[1]
    .split(",")
    .map(Number);
  return { scale, translateX, translateY };
}

function scaleOf(transform: string | null): number {
  return matrixOf(transform).scale;
}

// Locator.click aims at the centre of the path's bounding box, which lies in a neighbour
// for a country that wraps or spreads (the USA with Alaska and Hawaii). Return the page
// point nearest that centre that hit-tests to this very path, with a few pixels of margin
// so the border stroke is not the target. A real mouse then clicks or drags from there.
async function pointOnPath(path: Locator): Promise<{ x: number; y: number }> {
  await path.scrollIntoViewIfNeeded();
  const point = await path.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const centreX = box.left + box.width / 2;
    const centreY = box.top + box.height / 2;
    const isOnNode = (x: number, y: number) => document.elementFromPoint(x, y) === node;
    const candidates: { x: number; y: number; distance: number }[] = [];
    const steps = 48;
    for (let column = 0; column <= steps; column += 1) {
      for (let row = 0; row <= steps; row += 1) {
        const x = box.left + (box.width * column) / steps;
        const y = box.top + (box.height * row) / steps;
        candidates.push({ x, y, distance: Math.hypot(x - centreX, y - centreY) });
      }
    }
    candidates.sort((a, b) => a.distance - b.distance);
    const margin = 3;
    const found = candidates.find(
      ({ x, y }) =>
        isOnNode(x, y) &&
        isOnNode(x - margin, y) &&
        isOnNode(x + margin, y) &&
        isOnNode(x, y - margin) &&
        isOnNode(x, y + margin),
    );
    return found ? { x: found.x, y: found.y } : null;
  });
  if (!point) throw new Error("No visible point of the path hit-tests to it");
  return point;
}

// Both tests run under reduced motion, so a zoom would land at once; one painted frame is
// enough for React to have committed whatever the gesture triggered.
async function settleFrame(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => { requestAnimationFrame(() => { resolve(); }); }));
}

// Opens the taxonomy page on the World view, under reduced motion so a zoom lands at once.
// The page opens on the US view when the mocked data has state counts, so the World pill
// is clicked either way. A map path in the DOM means the topology has loaded and the page
// has hydrated, so the click is not lost to a server-rendered pill.
async function openWorldMap(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/taxonomy/234");

  const mapSection = page
    .locator("[data-slot='card']")
    .filter({ has: page.getByRole("heading", { level: 2, name: "Geographic Distribution" }) });
  const svg = mapSection.getByRole("img", { name: "Genome distribution map" });
  const mapGroup = svg.locator(":scope > g");
  const worldPill = mapSection.getByRole("button", { name: "World" });

  await expect(svg.locator("path").first()).toBeAttached({ timeout: 15_000 });
  await worldPill.click();
  await expect(worldPill).toHaveAttribute("aria-pressed", "true");
  await expect(svg.locator('path[data-region="Germany"]')).toBeAttached({ timeout: 15_000 });
  await expect(mapGroup).toHaveAttribute("transform", identityTransform);
  return { mapSection, svg, mapGroup, worldPill };
}

test.describe("taxonomy geographic distribution map", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [...workspaceOverrides, ...emptyBackendFallbackOverrides],
    });
  });

  test("renders the US choropleth, drills into a state, and lazy-loads the world view", async ({ page }) => {
    await page.goto("/taxonomy/234");

    // Use [data-slot='card']: 'section' matches nested layout ancestors that contain
    // this heading (strict-mode violation).
    const mapSection = page
      .locator("[data-slot='card']")
      .filter({ has: page.getByRole("heading", { level: 2, name: "Geographic Distribution" }) });
    await expect(mapSection.getByRole("heading", { level: 2, name: "Geographic Distribution" })).toBeVisible();
    await expect(mapSection.getByRole("button", { name: "World" })).toBeVisible();
    await expect(mapSection.getByRole("button", { name: "United States" })).toBeVisible();

    const svg = mapSection.getByRole("img", { name: "Genome distribution map" });
    await expect(svg).toBeVisible();
    const statePaths = svg.locator("path");
    await expect(statePaths.first()).toBeAttached();
    // Lower bound only, so a topology data update does not invalidate this.
    await expect.poll(async () => statePaths.count(), { timeout: 10_000 }).toBeGreaterThan(50);
    const baselineCount = await statePaths.count();

    // Select via the dropdown (resilient to TopoJSON path ordering); switch to State
    // view first so the combobox is interactive.
    await mapSection.getByRole("button", { name: "State", exact: true }).click();
    await mapSection.getByRole("combobox").click();
    await page.getByRole("option", { name: "Wyoming" }).click();

    await expect(svg.locator("path")).not.toHaveCount(baselineCount);

    await mapSection.getByRole("button", { name: "United States" }).click();
    await expect(svg.locator("path")).toHaveCount(baselineCount);

    // Register the waiter before the click: Firefox can serve the local static file
    // before waitForResponse attaches.
    const countriesResponse = page.waitForResponse((response) =>
      response.url().endsWith("/maps/countries-110m.json"),
    );
    await mapSection.getByRole("button", { name: "World" }).click();
    await countriesResponse;
    await expect(svg.locator("path").first()).toBeAttached();
    const worldPathCount = await svg.locator("path").count();
    expect(worldPathCount).toBeGreaterThan(100);
  });

  test("clicking a country on the world map zooms to it; Reset restores; the USA still opens the US view", async ({ page }) => {
    const { mapSection, svg, mapGroup, worldPill } = await openWorldMap(page);
    const usPill = mapSection.getByRole("button", { name: "United States" });
    const resetZoom = mapSection.getByRole("button", { name: "Reset zoom" });
    const germany = svg.locator('path[data-region="Germany"]');

    const germanyPoint = await pointOnPath(germany);
    await page.mouse.click(germanyPoint.x, germanyPoint.y);
    await expect.poll(async () => scaleOf(await mapGroup.getAttribute("transform"))).toBeGreaterThan(5);
    // The zoom fits the country: it now sits inside the map, not just under a bigger matrix.
    await expect
      .poll(async () => {
        const [country, map] = await Promise.all([germany.boundingBox(), svg.boundingBox()]);
        if (!country || !map) return false;
        const slack = 1;
        return (
          country.x >= map.x - slack &&
          country.y >= map.y - slack &&
          country.x + country.width <= map.x + map.width + slack &&
          country.y + country.height <= map.y + map.height + slack
        );
      })
      .toBe(true);
    // A country other than the USA stays in the world view.
    await expect(worldPill).toHaveAttribute("aria-pressed", "true");

    await resetZoom.click();
    await expect(mapGroup).toHaveAttribute("transform", identityTransform);

    const usa = svg.locator('path[data-region="United States of America"]');
    const usaPoint = await pointOnPath(usa);
    await page.mouse.click(usaPoint.x, usaPoint.y);
    await expect(usPill).toHaveAttribute("aria-pressed", "true");
    await expect(worldPill).toHaveAttribute("aria-pressed", "false");
    await expect(mapGroup).toHaveAttribute("transform", identityTransform);
  });

  test("a keyboard user zooms to a country from the Zoom to country Select", async ({ page }) => {
    const { mapSection, svg, mapGroup, worldPill } = await openWorldMap(page);
    const countrySelect = mapSection.getByRole("combobox", { name: "Zoom to country" });
    const resetZoom = mapSection.getByRole("button", { name: "Reset zoom" });
    // The popup portals outside the map card. Base UI lists the options a moment before it
    // moves focus onto one; a key typed in that gap reaches the trigger, whose Enter closes
    // the popup without picking. Keys are sent once focus is in the list, as a person's are.
    const focusedOption = page.getByRole("option").and(page.locator(":focus"));

    // Keyboard only, from a focused Select: Enter opens the list, type-ahead moves to
    // Italy, Enter commits it.
    const pickItalyByKeyboard = async () => {
      await page.keyboard.press("Enter");
      await expect(focusedOption).toBeVisible();
      await page.keyboard.type("Ital");
      await page.keyboard.press("Enter");
    };

    // Reach the Select as a keyboard user does: from the World pill, Tab passes the United
    // States and State pills, then lands on the Select.
    await worldPill.focus();
    for (const pill of ["United States", "State"]) {
      await page.keyboard.press("Tab");
      await expect(mapSection.getByRole("button", { name: pill, exact: true })).toBeFocused();
    }
    await page.keyboard.press("Tab");
    await expect(countrySelect).toBeFocused();
    await pickItalyByKeyboard();

    await expect.poll(async () => scaleOf(await mapGroup.getAttribute("transform"))).toBeGreaterThan(5);
    const italy = svg.locator('path[data-region="Italy"]');
    await expect
      .poll(async () => {
        const [country, map] = await Promise.all([italy.boundingBox(), svg.boundingBox()]);
        if (!country || !map) return false;
        const slack = 1;
        return (
          country.x >= map.x - slack &&
          country.y >= map.y - slack &&
          country.x + country.width <= map.x + map.width + slack &&
          country.y + country.height <= map.y + map.height + slack
        );
      })
      .toBe(true);
    // Focus stays on the Select and the view is still World.
    await expect(countrySelect).toBeFocused();
    await expect(worldPill).toHaveAttribute("aria-pressed", "true");

    // The collapsed State Select is inert, so the next Tab skips its hidden "View state"
    // trigger and lands on the map's Zoom in button.
    await page.keyboard.press("Tab");
    await expect(mapSection.getByRole("button", { name: "Zoom in" })).toBeFocused();

    await resetZoom.click();
    await expect(mapGroup).toHaveAttribute("transform", identityTransform);
    // The same pick works again after Reset.
    await countrySelect.focus();
    await pickItalyByKeyboard();
    await expect.poll(async () => scaleOf(await mapGroup.getAttribute("transform"))).toBeGreaterThan(5);
    await expect(countrySelect).toBeFocused();
  });

  test("dragging the world map from a country pans it and does not zoom to the country", async ({ page }) => {
    const { svg, mapGroup, worldPill } = await openWorldMap(page);
    const brazil = svg.locator('path[data-region="Brazil"]');
    await expect(brazil).toBeAttached();

    const start = await pointOnPath(brazil);
    const dragX = 60;
    const dragY = 30;
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + dragX / 2, start.y + dragY / 2, { steps: 4 });
    await page.mouse.move(start.x + dragX, start.y + dragY, { steps: 4 });
    // The map pans with the pointer, so the release lands on Brazil again: the browser
    // sends it a click, the case a drag must not turn into a zoom.
    const release = { x: start.x + dragX, y: start.y + dragY };
    await expect
      .poll(() =>
        page.evaluate(
          ({ x, y }) => document.elementFromPoint(x, y)?.getAttribute("data-region") ?? null,
          release,
        ),
      )
      .toBe("Brazil");
    await page.mouse.up();
    await settleFrame(page);

    // Panned (the translate follows the pointer) and not zoomed (the scale is still 1).
    // The poll only waits for the pan to commit; the real guard against a zoom is the
    // `scale === 1` assertion below.
    await expect.poll(async () => matrixOf(await mapGroup.getAttribute("transform")).translateX).toBeGreaterThan(0);
    const { scale, translateX, translateY } = matrixOf(await mapGroup.getAttribute("transform"));
    expect(scale).toBe(1);
    expect(translateY).toBeGreaterThan(0);
    expect(translateX).toBeLessThanOrEqual(dragX);
    await expect(worldPill).toHaveAttribute("aria-pressed", "true");
  });

  test("lazy-loads the counties topology only when a state is selected", async ({ page }) => {
    const fetchedTopos: string[] = [];
    page.on("response", (response) => {
      const url = response.url();
      if (/\/maps\/.+\.json$/.test(url)) fetchedTopos.push(url);
    });

    await page.goto("/taxonomy/234");
    const mapSection = page
      .locator("[data-slot='card']")
      .filter({ has: page.getByRole("heading", { level: 2, name: "Geographic Distribution" }) });
    await expect(mapSection.getByRole("img", { name: "Genome distribution map" })).toBeVisible();

    // counties-10m.json must not be fetched until a state is selected.
    await expect.poll(() => fetchedTopos.some((url) => url.endsWith("/maps/states-10m.json"))).toBe(true);
    expect(fetchedTopos.some((url) => url.endsWith("/maps/counties-10m.json"))).toBe(false);

    // expect.poll on the registered listener avoids the waitForResponse race with the
    // local static file.
    await mapSection.getByRole("button", { name: "State", exact: true }).click();
    await mapSection.getByRole("combobox").click();
    await page.getByRole("option", { name: "Wyoming" }).click();
    await expect.poll(
      () => fetchedTopos.some((url) => url.endsWith("/maps/counties-10m.json")),
      { timeout: 30_000 },
    ).toBe(true);
  });

  test("disables the State pill and does not drill into a state when the taxon has no county data", async ({ page }) => {
    // The loopback answers this taxon's county pivots empty, as the Data API does.
    await page.goto(`/taxonomy/${noCountyTaxonId}`);
    const mapSection = page
      .locator("[data-slot='card']")
      .filter({ has: page.getByRole("heading", { level: 2, name: "Geographic Distribution" }) });

    const statePill = mapSection.getByRole("button", { name: "State", exact: true });
    await expect(statePill).toBeDisabled();
    await expect(statePill).toHaveAccessibleDescription(
      "County-level data is not available for this taxon.",
    );

    const svg = mapSection.getByRole("img", { name: "Genome distribution map" });
    const statePaths = svg.locator("path");
    await expect.poll(async () => statePaths.count(), { timeout: 10_000 }).toBeGreaterThan(50);
    const baselineCount = await statePaths.count();

    // ChoroplethPath draws `cursor-default` exactly when a state cannot be
    // drilled into, which holds whether or not the click below lands.
    const state = statePaths.nth(10);
    await expect(state).toHaveClass(/cursor-default/);

    // A state click must leave the US view in place. Click a point that
    // hit-tests to the state itself, so the click cannot miss and pass.
    const point = await pointOnPath(state);
    await page.mouse.click(point.x, point.y);
    await expect(mapSection.getByRole("button", { name: "United States" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(statePaths).toHaveCount(baselineCount);
  });

  test("breadcrumb shows BV-BRC's ranked lineage with /taxonomy/<id> links", async ({ page }) => {
    await page.goto("/taxonomy/234");

    // BV-BRC's Taxon View keeps phylum … species only (lineage-crumbs.ts).
    const heading = page.getByRole("heading", { level: 1, name: "Brucella" });
    await expect(heading).toBeVisible();
    const trail = heading.locator("..");
    await expect(trail.getByRole("link")).toHaveText([
      "Pseudomonadota",
      "Alphaproteobacteria",
      "Hyphomicrobiales",
      "Brucellaceae",
    ]);
    await expect(trail.getByRole("link", { name: "Pseudomonadota" })).toHaveAttribute(
      "href",
      "/taxonomy/1224",
    );
    await expect(trail.getByRole("link", { name: "Bacteria", exact: true })).toHaveCount(0);
  });
});
