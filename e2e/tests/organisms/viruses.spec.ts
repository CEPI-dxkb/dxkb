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

  test("family card unfolds its major human pathogens", async ({ page }) => {
    const landing = new OrganismLandingPage(page);

    await landing.goto("viruses");
    await page.waitForLoadState("networkidle");

    const toggle = landing.getPathogensToggle("Coronaviridae");
    const panel = landing.getPathogensPanel("Coronaviridae");
    const otherCard = landing.getFamilyCardWrapper("Caliciviridae");

    await expect(panel).toBeHidden();
    await expect(otherCard).toHaveCSS("opacity", "1");

    await toggle.hover();
    await expect(
      panel.getByRole("link", { name: "SARS-CoV-2" }),
    ).toHaveAttribute("href", "/taxonomy/2697049");
    await expect(otherCard).toHaveCSS("opacity", "0.5");

    // The panel is hoverable: the pointer can move onto it without closing it.
    await panel.getByRole("link", { name: "MERS-CoV" }).hover();
    await expect(panel).toBeVisible();

    // Back on the toggle before Escape: closing the panel under a pointer that
    // is over a chip would let the card beneath it open, which is not the test.
    await toggle.hover();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(otherCard).toHaveCSS("opacity", "1");

    // Keyboard parity: hover is not the only way in.
    await page.mouse.move(0, 0);
    await toggle.focus();
    await expect(panel).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(toggle).toBeFocused();

    // Escape from inside the panel hands focus back to the toggle, not <body>.
    await page.keyboard.press("Enter");
    // Focus the chip directly: WebKit's Tab skips links unless full keyboard
    // access is on, which is not what this step is about.
    await panel.getByRole("link").first().focus();
    await expect(panel.getByRole("link").first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(toggle).toBeFocused();
  });

  test("a clicked toggle stays open until a press outside", async ({ page }) => {
    const landing = new OrganismLandingPage(page);

    await landing.goto("viruses");
    await page.waitForLoadState("networkidle");

    const panel = landing.getPathogensPanel("Flaviviridae");

    await landing.getPathogensToggle("Flaviviridae").click();
    await page.mouse.move(0, 0);
    await expect(panel).toBeVisible();

    await page.getByRole("heading", { level: 1, name: "Viruses" }).click();
    await expect(panel).toBeHidden();
  });

  test("a family with no human pathogens says so", async ({ page }) => {
    const landing = new OrganismLandingPage(page);

    await landing.goto("viruses");
    await page.waitForLoadState("networkidle");

    await landing.getPathogensToggle("Asfarviridae").click();
    await expect(landing.getPathogensPanel("Asfarviridae")).toContainText(
      "No known human pathogens",
    );
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
