import {
  emptyBackendFallbackOverrides,
  surveillanceScenarioOverrides,
} from "../fixtures/overrides";
import { applyBackendMocks, expect, test } from "../mocks/backends";
import { SurveillancePage } from "../pages";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Surveillance view", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...surveillanceScenarioOverrides,
        ...emptyBackendFallbackOverrides,
      ],
    });
  });

  test("searches the collection, refines via the API, and opens the compound member", async ({
    page,
  }) => {
    const keywordRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === "/api/data/surveillance" &&
        url.searchParams.get("keyword") === "sentinel"
      );
    });
    const surveillancePage = new SurveillancePage(page);
    await surveillancePage.searchFromWelcome("sentinel");
    await keywordRequest;

    await surveillancePage.expectCollection("sentinel");
    await surveillancePage.expectMemberVisible("sample/1");

    const refinementRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === "/api/data/surveillance" &&
        url.searchParams.get("keyword") === "sentinel" &&
        url.searchParams.get("rql")?.includes("keyword(Nasal swab)") === true
      );
    });
    await surveillancePage.filterCollection("Nasal swab");
    await refinementRequest;
    await surveillancePage.expectMemberVisible("sample/1");
    await expect(page).toHaveURL(
      "/surveillance?keyword=sentinel&refine=Nasal+swab",
    );

    const facetRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === "/api/data/surveillance" &&
        url.searchParams.get("keyword") === "sentinel" &&
        url.searchParams.get("rql")?.includes("keyword(Nasal swab)") === true
      );
    });
    await surveillancePage.selectFacet("RAT/antigen (1)");
    await facetRequest;
    await expect(page).toHaveURL(
      /\/surveillance\?keyword=sentinel&refine=Nasal\+swab&pathogen_test_type=RAT%2Fantigen$/,
    );

    await surveillancePage.openMember("sample/1", "RAT/antigen");
    await surveillancePage.expectOverview();
  });

  test("offers encoded test-type choices for an ambiguous sample", async ({
    page,
  }) => {
    const surveillancePage = new SurveillancePage(page);
    await surveillancePage.gotoMember("ambiguous-sample");
    await surveillancePage.expectAmbiguityChoices("PCR", "RAT/antigen");
    await surveillancePage.expectAmbiguityChoiceLink(
      "ambiguous-sample",
      "RAT/antigen",
    );
    await surveillancePage.chooseAmbiguityChoice(
      "ambiguous-sample",
      "RAT/antigen",
    );
  });
});
