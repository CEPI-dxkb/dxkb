import { applyBackendMocks, test } from "../mocks/backends";
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

  test("redirects legacy Taxa search URLs", async ({ page }) => {
    const taxonomyPage = new TaxonomyCollectionPage(page);
    await taxonomyPage.gotoLegacySearch("influenza");
    await taxonomyPage.expectCollection("influenza");
    await taxonomyPage.expectTaxonVisible("11520");
  });
});
