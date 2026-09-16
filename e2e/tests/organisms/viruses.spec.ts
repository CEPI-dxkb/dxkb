import { test, expect, applyBackendMocks } from "../../mocks/backends";
import {
  emptyBackendFallbackOverrides,
  genomeScenarioOverrides,
  workspaceOverrides,
} from "../../fixtures/overrides";
import { OrganismLandingPage } from "../../pages/organism-landing-page";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("viruses organism landing page", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        {
          url: /\/api\/e2e-mock\/data\/genome\/\?eq\(taxon_lineage_ids,10239\)&limit\(1\)(?:&|$)/,
          method: "GET",
          body: { response: { numFound: 0, docs: [] } },
        },
        ...workspaceOverrides,
        ...genomeScenarioOverrides,
        ...emptyBackendFallbackOverrides,
      ],
    });
  });

  test("renders the curated overview and shared taxonomy views", async ({ page }) => {
    const landing = new OrganismLandingPage(page);

    await landing.goto("viruses");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { level: 1, name: "Viruses" })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toHaveCount(0);
    await expect(landing.getKpi("Genomes")).toContainText("890,123");
    await expect(page.getByRole("heading", { name: "Virus Families" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Featured Viruses" })).toBeVisible();
    await landing.expectDonut("Family");
    await landing.expectDonut("Host Group");
    await landing.expectDonut("Isolation Country");

    await expect(page.getByRole("button", { name: /Phylogeny/ })).toHaveCount(0);

    await page.getByRole("button", { name: /Genomes/ }).click();
    await expect(page).toHaveURL(/\/organisms\/viruses\?tab=genomes/);
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByText("This view is coming soon")).toHaveCount(0);

    await page.goto("/organisms/viruses?tab=interactions");
    await expect(page).toHaveURL(/\/organisms\/viruses$/);
  });

  test("matches the visual snapshot", async ({ page }) => {
    const landing = new OrganismLandingPage(page);

    await landing.goto("viruses");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("viruses-organism-landing.png", {
      fullPage: true,
      timeout: 15_000,
    });
  });
});
