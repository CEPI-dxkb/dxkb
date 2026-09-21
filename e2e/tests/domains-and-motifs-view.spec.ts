import {
  emptyBackendFallbackOverrides,
  proteinFeatureScenarioOverrides,
} from "../fixtures/overrides";
import { applyBackendMocks, expect, test } from "../mocks/backends";
import { DomainsAndMotifsPage } from "../pages";

test.use({ storageState: { cookies: [], origins: [] } });

const domainsAndMotifsOverrides = [
  ...proteinFeatureScenarioOverrides,
  ...emptyBackendFallbackOverrides,
];

test.describe("Domains and Motifs view", () => {
  test("renders the list-only collection with canonical links and no Deprecated scope", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [...domainsAndMotifsOverrides],
    });
    const domainsAndMotifsPage = new DomainsAndMotifsPage(page);

    const request = await domainsAndMotifsPage.gotoForGenome("1282460.2049");

    expect(request.url()).toContain("eq%28genome_id%2C1282460.2049%29");
    expect(request.url()).not.toContain("Deprecated");
    await domainsAndMotifsPage.expectProteinFeature(
      "replicase polyprotein",
      "fig|1282460.2049.peg.1",
    );
    await domainsAndMotifsPage.expectFiltersAvailable();
  });

  test("redirects both legacy list aliases", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [...domainsAndMotifsOverrides],
    });
    const domainsAndMotifsPage = new DomainsAndMotifsPage(page);

    await domainsAndMotifsPage.expectLegacyRedirect(
      "DomainsAndMotifsList",
      "genome_id=1282460.2049",
    );
    await domainsAndMotifsPage.expectLegacyRedirect(
      "ProteinFeaturesList",
      "feature_id=PATRIC.1",
    );
  });
});
