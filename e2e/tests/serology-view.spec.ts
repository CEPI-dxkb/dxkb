import {
  emptyBackendFallbackOverrides,
  serologyScenarioOverrides,
} from "../fixtures/overrides";
import { applyBackendMocks, expect, test } from "../mocks/backends";
import { SerologyPage } from "../pages";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Serology view", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [...serologyScenarioOverrides, ...emptyBackendFallbackOverrides],
    });
  });

  test("searches the collection and opens the scalar compound member", async ({
    page,
  }) => {
    const keywordRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === "/api/data/serology" &&
        url.searchParams.get("keyword") === "antibody"
      );
    });
    const serologyPage = new SerologyPage(page);
    await serologyPage.searchFromWelcome("antibody");
    await keywordRequest;

    await serologyPage.expectCollection("antibody");
    await expect(serologyPage.memberLink("000123")).toBeVisible();

    const refinementRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === "/api/data/serology" &&
        url.searchParams.get("keyword") === "antibody" &&
        Boolean(url.searchParams.get("rql")?.includes("keyword(000123)"))
      );
    });
    await serologyPage.refineCollection("000123");
    await refinementRequest;
    await expect(page).toHaveURL(
      "/serology?keyword=antibody&refine=000123",
    );
    await expect(serologyPage.memberLink("000123")).toBeVisible();

    await serologyPage.memberLink("000123").click();
    await expect(page).toHaveURL(
      serologyPage.memberUrl("000123", "ELISA/IgG test"),
    );
    await serologyPage.expectOverview();
  });

  test("offers encoded test-type choices for an ambiguous sample", async ({
    page,
  }) => {
    const serologyPage = new SerologyPage(page);
    await serologyPage.gotoMember("ambiguous-serology");
    await serologyPage.expectAmbiguityChoices("ELISA/IgG test", "Western blot");
    await serologyPage.chooseAmbiguityChoice(
      "ambiguous-serology",
      "ELISA/IgG test",
    );
  });
});
