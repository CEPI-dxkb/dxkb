import { test, expect, applyBackendMocks } from "../mocks/backends";
import { emptyBackendFallbackOverrides, workspaceOverrides } from "../fixtures/overrides";
import { TaxonPage } from "../pages/taxon-page";
import { failOnRuntimeErrors } from "../support/runtime-errors";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("taxonomy overview chart visibility", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [...workspaceOverrides, ...emptyBackendFallbackOverrides],
    });
  });

  test("a hidden chart stays hidden after a reload and comes back with Show all", async ({ page }) => {
    const assertNoRuntimeErrors = failOnRuntimeErrors(page);
    const taxon = new TaxonPage(page);
    await taxon.goto("234");

    await expect(taxon.metadataChart("Host Group")).toBeVisible();
    await taxon.setChartShown("Host Group", false);
    await expect(taxon.metadataChart("Host Group")).toBeHidden();
    await expect(taxon.metadataChart("Isolation Country")).toBeVisible();

    await page.reload();
    await expect(taxon.metadataChart("Isolation Country")).toBeVisible();
    await expect(taxon.metadataChart("Host Group")).toBeHidden();
    await expect(taxon.chartsMenu).toHaveAccessibleName(/customised/);

    await taxon.showAllCharts();
    await expect(taxon.metadataChart("Host Group")).toBeVisible();
    await expect(taxon.chartsMenu).not.toHaveAccessibleName(/customised/);
    assertNoRuntimeErrors();
  });
});
