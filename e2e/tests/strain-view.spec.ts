import {
  emptyBackendFallbackOverrides,
  strainAllTypesSearchOverrides,
  strainScenarioOverrides,
} from "../fixtures/overrides";
import { applyBackendMocks, expect, test } from "../mocks/backends";
import { StrainPage } from "../pages";

test.use({ storageState: { cookies: [], origins: [] } });

// Both strain fixture records carry this name; only their IDs differ.
const strainName = "A/California/04/2009";

test.describe("Strain view", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...strainAllTypesSearchOverrides,
        ...strainScenarioOverrides,
        ...emptyBackendFallbackOverrides,
      ],
    });
  });

  test("links each all-types search strain to its own record", async ({
    page,
  }) => {
    const strainPage = new StrainPage(page);
    await strainPage.gotoAllTypesSearch("influenza");

    const links = strainPage.strainLinks(strainName);
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAttribute(
      "href",
      "/strain/strain-backend-901",
    );
    await expect(links.nth(1)).toHaveAttribute(
      "href",
      "/strain/strain-backend-902",
    );

    await links.nth(1).click();
    await strainPage.expectMember("strain-backend-902", strainName);
    await strainPage.expectSummary("Status", "Partial");
  });

  test("opens a member from the Strain list with its genomes", async ({
    page,
  }) => {
    const strainPage = new StrainPage(page);
    await strainPage.gotoCollection();

    await strainPage.strainLinks(strainName).first().click();
    await strainPage.expectMember("strain-backend-901", strainName);
    await strainPage.expectSummary("Subtype", "H1N1");
    await expect(page.getByRole("link", { name: "641501.3" })).toHaveAttribute(
      "href",
      "/genome/641501.3",
    );
    await expect(strainPage.viewGenomesLink()).toHaveAttribute(
      "href",
      "/genome?rql=in(genome_id,(641501.3,641501.4))",
    );
  });
});
