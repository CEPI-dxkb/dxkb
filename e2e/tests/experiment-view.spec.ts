import { permissiveBackendOverrides } from "../fixtures/overrides";
import { applyBackendMocks, expect, test } from "../mocks/backends";
import { ExperimentPage } from "../pages";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Experiment view", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, { overrides: [...permissiveBackendOverrides] });
  });

  test("shows Biosets for matching collection Experiments", async ({ page }) => {
    const experimentPage = new ExperimentPage(page);
    await page.goto("/experiment?keyword=influenza");
    await expect(
      page.getByRole("button", { name: "Biosets", exact: true }),
    ).toBeVisible();
    const biosetRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === "/api/data/bioset" &&
        url.searchParams.get("rql") === "in(exp_id,(2000000))"
      );
    });
    await experimentPage.openCollectionBiosets();
    await biosetRequest;
    await expect(page.getByText("Infected versus mock")).toBeVisible();
  });

  test("opens a member and loads exact-scope Biosets", async ({ page }) => {
    const experimentPage = new ExperimentPage(page);
    await page.goto("/experiment");
    await expect(page).toHaveURL("/experiment");
    await expect(page.getByRole("heading", { level: 1, name: "Experiments" })).toBeVisible();
    await experimentPage.openMember("2000000");
    await expect(page.getByText("Ada Scientist")).toBeVisible();
    await expect(page.getByRole("link", { name: "1282460.2049" })).toHaveAttribute("href", "/genome/1282460.2049");

    const biosetRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return url.pathname === "/api/data/bioset" && url.searchParams.get("rql") === "eq(exp_id,2000000)";
    });
    await experimentPage.openBiosets();
    await biosetRequest;
    await expect(page.getByText("Infected versus mock")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "2000000" })).toBeVisible();
  });
});
