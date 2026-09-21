import {
  emptyBackendFallbackOverrides,
  epitopeAssayScenarioOverrides,
  epitopeScenarioOverrides,
} from "../fixtures/overrides";
import { applyBackendMocks, expect, test } from "../mocks/backends";
import { EpitopePage } from "../pages";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Epitope view", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...epitopeScenarioOverrides,
        ...epitopeAssayScenarioOverrides,
        ...emptyBackendFallbackOverrides,
      ],
    });
  });

  test("searches the full collection and opens the canonical member and assays", async ({
    page,
  }) => {
    const keywordRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === "/api/data/epitope" &&
        url.searchParams.get("keyword") === "Brucella"
      );
    });
    const epitopePage = new EpitopePage(page);
    await epitopePage.searchFromWelcome("Brucella");
    await keywordRequest;

    await epitopePage.expectCollection("Brucella");
    await epitopePage.expectMemberVisible("15780");

    const refinementRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === "/api/data/epitope" &&
        url.searchParams.get("keyword") === "Brucella" &&
        url.searchParams.get("rql")?.includes("keyword(hemagglutinin)") === true
      );
    });
    await epitopePage.filterCollection("hemagglutinin");
    await refinementRequest;
    await epitopePage.expectMemberVisible("15780");
    await expect(page).toHaveURL(
      "/epitope?keyword=Brucella&refine=hemagglutinin",
    );

    await epitopePage.clearCollectionFilter();
    await epitopePage.expectMemberVisible("15780");
    await epitopePage.expectCollectionUrl("Brucella");

    const facetRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === "/api/data/epitope" &&
        url.searchParams.get("keyword") === "Brucella"
      );
    });
    await epitopePage.selectFacet("Discontinuous peptide (1)");
    await facetRequest;
    await expect(page).toHaveURL(
      /\/epitope\?keyword=Brucella&epitope_type=Discontinuous\+peptide$/,
    );

    await epitopePage.openMember("15780");
    await epitopePage.expectStructure("A1, C4, D8");
    await epitopePage.expectMemberShell("15780");

    const assayRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === "/api/data/epitope_assay" &&
        url.searchParams.get("rql") === "eq(epitope_id,15780)"
      );
    });
    await epitopePage.openAssays();
    await assayRequest;
    await epitopePage.expectAssays("ELISA", "Neutralization");
  });

  test("shows empty and failed assay states without losing the member shell", async ({
    page,
  }) => {
    const epitopePage = new EpitopePage(page);
    await page.route(/\/api\/data\/epitope_assay(?:\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rows: [],
          total: 0,
          facets: {},
          page: 1,
          pageSize: 200,
        }),
      });
    });
    await epitopePage.gotoMemberAssays("15780");
    await epitopePage.expectNoResults();
    await epitopePage.expectMemberShell("15780");

    await page.unroute(/\/api\/data\/epitope_assay(?:\?|$)/);
    await page.route(/\/api\/data\/epitope_assay(?:\?|$)/, async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Epitope assay backend unavailable" }),
      });
    });
    await page.reload();
    await epitopePage.expectError(/Epitope assay backend unavailable/);
  });
});
