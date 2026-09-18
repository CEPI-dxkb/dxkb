import { test, expect, applyBackendMocks } from "../mocks/backends";
import { emptyBackendFallbackOverrides, workspaceOverrides } from "../fixtures/overrides";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("taxonomy geographic distribution map", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [...workspaceOverrides, ...emptyBackendFallbackOverrides],
    });
  });

  test("renders the US choropleth, drills into a state, and lazy-loads the world view", async ({ page }) => {
    await page.goto("/taxonomy/234");

    // Card heading and toolbar are visible.
    // Use [data-slot='card'] instead of 'section' because 'section' matches nested
    // layout ancestors that also contain this heading, causing strict-mode violations.
    const mapSection = page
      .locator("[data-slot='card']")
      .filter({ has: page.getByRole("heading", { level: 2, name: "Geographic Distribution" }) });
    await expect(mapSection.getByRole("heading", { level: 2, name: "Geographic Distribution" })).toBeVisible();
    await expect(mapSection.getByRole("button", { name: "World" })).toBeVisible();
    await expect(mapSection.getByRole("button", { name: "United States" })).toBeVisible();

    // The map SVG renders with state paths
    const svg = mapSection.getByRole("img", { name: "Genome distribution map" });
    await expect(svg).toBeVisible();
    const statePaths = svg.locator("path");
    await expect(statePaths.first()).toBeAttached();
    // us-atlas states-10m.json includes the 50 states + DC + territories.
    // Lower bound only: a topology data update should not invalidate this test.
    await expect.poll(async () => statePaths.count(), { timeout: 10_000 }).toBeGreaterThan(50);
    const baselineCount = await statePaths.count();

    // Drill into Wyoming via the dropdown (most resilient to TopoJSON path ordering).
    // Switch to State view first so the combobox becomes interactive.
    await mapSection.getByRole("button", { name: "State", exact: true }).click();
    await mapSection.getByRole("combobox").click();
    await page.getByRole("option", { name: "Wyoming" }).click();

    // County paths loaded — count differs from the US-states baseline
    await expect(svg.locator("path")).not.toHaveCount(baselineCount);

    // Exit drill-down by switching back to United States view
    await mapSection.getByRole("button", { name: "United States" }).click();
    await expect(svg.locator("path")).toHaveCount(baselineCount);

    // Switch to the World view — triggers lazy-load of countries-110m.json.
    // Register the waiter before the click to avoid a race where Firefox serves
    // the local static file before waitForResponse is attached.
    const countriesResponse = page.waitForResponse((response) =>
      response.url().endsWith("/maps/countries-110m.json"),
    );
    await mapSection.getByRole("button", { name: "World" }).click();
    await countriesResponse;
    // World choropleth has many country paths
    await expect(svg.locator("path").first()).toBeAttached();
    const worldPathCount = await svg.locator("path").count();
    expect(worldPathCount).toBeGreaterThan(100);
  });

  test("lazy-loads the counties topology only when a state is selected", async ({ page }) => {
    // Track which topo files the browser requests over the page's lifetime.
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

    // After initial render: states-10m.json must be fetched. The much larger
    // counties-10m.json must NOT be fetched until a state is selected.
    await expect.poll(() => fetchedTopos.some((url) => url.endsWith("/maps/states-10m.json"))).toBe(true);
    expect(fetchedTopos.some((url) => url.endsWith("/maps/counties-10m.json"))).toBe(false);

    // Drill into a state — should trigger the counties fetch.
    // Switch to State view first so the combobox becomes interactive.
    // Use expect.poll on the already-registered response listener instead of waitForResponse
    // to avoid a race where the local static file responds before the waiter is attached.
    await mapSection.getByRole("button", { name: "State", exact: true }).click();
    await mapSection.getByRole("combobox").click();
    await page.getByRole("option", { name: "Wyoming" }).click();
    await expect.poll(
      () => fetchedTopos.some((url) => url.endsWith("/maps/counties-10m.json")),
      { timeout: 30_000 },
    ).toBe(true);
  });

  test("breadcrumb ancestor links navigate to the corresponding /taxonomy/<id>", async ({ page }) => {
    await page.goto("/taxonomy/234");

    // The taxon-breadcrumb shows ancestors as links. From Brucella, the bvbrc-website
    // fixture exposes a Bacteria ancestor with id=2.
    const bacteriaLink = page.getByRole("link", { name: "Bacteria", exact: true });
    await expect(bacteriaLink).toBeVisible();
    await expect(bacteriaLink).toHaveAttribute("href", "/taxonomy/2");

    // Clicking should navigate to the bacteria page (also a /taxonomy/<id> route).
    await bacteriaLink.click();
    await expect(page).toHaveURL(/\/taxonomy\/2/);
    // The shell mounts the same OrganismLandingShell with a refreshed taxon header.
    await expect(page.getByRole("heading", { level: 1, name: "Bacteria" })).toBeVisible();
  });
});
