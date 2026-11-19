import { test, expect, applyBackendMocks } from "../../mocks/backends";
import {
  emptyBackendFallbackOverrides,
  genomeScenarioOverrides,
  taxonGenomeCounts,
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
    await expect(landing.getKpi("Genomes")).toContainText(
      taxonGenomeCounts["10239"].toLocaleString("en-US"),
    );
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

  test("family card info button lists major human pathogens", async ({ page }) => {
    const landing = new OrganismLandingPage(page);

    await landing.goto("viruses");
    await page.waitForLoadState("networkidle");

    const info = landing.getFamilyInfoButton("Coronaviridae");
    const dialog = page.getByRole("dialog", {
      name: "Major human pathogens in Coronaviridae",
    });

    await info.hover();
    await expect(
      dialog.getByRole("link", { name: "SARS-CoV-2" }),
    ).toHaveAttribute("href", "/taxonomy/2697049");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // Keyboard parity: hover is not the only way in.
    await page.mouse.move(0, 0);
    await info.focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("a family with no human pathogens says so", async ({ page }) => {
    const landing = new OrganismLandingPage(page);

    await landing.goto("viruses");
    await page.waitForLoadState("networkidle");

    await landing.getFamilyInfoButton("Asfarviridae").click();
    await expect(
      page.getByRole("dialog", { name: "Major human pathogens in Asfarviridae" }),
    ).toContainText("No known human pathogens");
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
