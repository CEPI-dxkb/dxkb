import { applyBackendMocks, expect, test } from "../mocks/backends";
import {
  emptyBackendFallbackOverrides,
  taxonomyScenarioOverrides,
} from "../fixtures/overrides";
import { TaxonomyCollectionPage } from "../pages";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Taxonomy collection", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [...taxonomyScenarioOverrides, ...emptyBackendFallbackOverrides],
    });
  });

  test("searches Taxa canonically and opens the selected Taxon", async ({ page }) => {
    const taxonomyPage = new TaxonomyCollectionPage(page);
    await taxonomyPage.searchFromWelcome("influenza");
    await taxonomyPage.expectCollection("influenza");
    await taxonomyPage.expectTaxonVisible("11520");
    await taxonomyPage.selectTaxon("11520", "Influenza A virus");
    await taxonomyPage.openServices();
    await taxonomyPage.expectServiceOptions();
  });

  test("waits for a narrowed query's results before resolving every matching Taxon", async ({
    page,
  }) => {
    // Hold the narrowed query's rows, so the previous query's rows and total are
    // still on screen when every result is selected. Registered after the mocks,
    // so it is matched first.
    let releaseNarrowed!: () => void;
    const narrowedHeld = new Promise<void>((resolve) => {
      releaseNarrowed = resolve;
    });
    let narrowedRequested = false;
    const isNarrowedQuery = (url: URL) =>
      url.pathname === "/api/data/taxonomy" &&
      url.searchParams.get("rql")?.includes("keyword(virus)") === true;
    await page.route(
      isNarrowedQuery,
      async (route) => {
        if (route.request().method() === "GET") {
          narrowedRequested = true;
          await narrowedHeld;
        }
        await route.fallback();
      },
    );
    const taxonomyPage = new TaxonomyCollectionPage(page);
    await taxonomyPage.searchFromWelcome("influenza");
    await taxonomyPage.expectTaxonVisible("11520");

    await taxonomyPage.filterCollection("virus");
    await expect.poll(() => narrowedRequested).toBe(true);
    await taxonomyPage.selectAllResults();
    await page.getByRole("button", { name: "SERVICES", exact: true }).click();

    await expect(
      page.getByText(
        "Wait for the current results to finish loading and try again.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Use selected Taxa in a service" }),
    ).toHaveCount(0);

    await taxonomyPage.expectRefreshing(true);

    // Once the narrowed rows land, the same selection resolves. The fixture serves
    // the same row to both queries, so only the refresh status tells them apart.
    const narrowedResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        isNarrowedQuery(new URL(response.url())),
    );
    releaseNarrowed();
    await narrowedResponse;
    await taxonomyPage.expectRefreshing(false);
    await taxonomyPage.expectTaxonVisible("11520");
    await taxonomyPage.openServices();
    await taxonomyPage.expectServiceOptions();
    await expect(
      page.getByText(
        "Wait for the current results to finish loading and try again.",
      ),
    ).toHaveCount(0);
  });

  test("redirects legacy Taxa search URLs", async ({ page }) => {
    const taxonomyPage = new TaxonomyCollectionPage(page);
    await taxonomyPage.gotoLegacySearch("influenza");
    await taxonomyPage.expectCollection("influenza");
    await taxonomyPage.expectTaxonVisible("11520");
  });
});
