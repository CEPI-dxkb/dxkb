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
