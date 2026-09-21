import { test, expect, applyBackendMocks } from "../../mocks/backends";
import {
  emptyBackendFallbackOverrides,
  genomeScenarioOverrides,
  workspaceOverrides,
} from "../../fixtures/overrides";
import { OrganismLandingPage } from "../../pages/organism-landing-page";

test.use({ storageState: { cookies: [], origins: [] } });

// Mobile-only tests: the floating pill nav replaces the desktop rail below `lg` (1024px).
test.describe("bacteria organism landing page — mobile pill nav", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [...workspaceOverrides, ...genomeScenarioOverrides, ...emptyBackendFallbackOverrides],
    });
  });

  test("pill hides on scroll-down and reveals on scroll-up", async ({ page }) => {
    const landing = new OrganismLandingPage(page);
    await landing.goto("bacteria");

    const pill = page.getByRole("button", { name: /Views:/ });
    await expect(pill).toBeVisible();

    const scrollRegion = page.getByTestId("landing-scroll-region");
    // Scroll past the 60px floor — pill should hide (opacity: 0 after transition)
    await scrollRegion.evaluate((element) => { element.scrollTo({ top: 300, behavior: "instant" }); });
    const pillWrapper = page.locator("div.fixed.bottom-4");
    await expect(pillWrapper).toHaveCSS("opacity", "0", { timeout: 2000 });

    // Scroll back up — pill should reveal
    await scrollRegion.evaluate((element) => { element.scrollTo({ top: 0, behavior: "instant" }); });
    await expect(pillWrapper).toHaveCSS("opacity", "1", { timeout: 2000 });
  });

  test("pill still hides on scroll-down after the view sheet is opened and closed (regression: focus-within override)", async ({ page }) => {
    // Regression: CSS :focus-within fired when the dialog restored focus to the trigger on
    // close, overriding the scroll-hide transform with higher CSS specificity. The pill stayed
    // visible regardless of scroll position after any sheet open/close cycle.
    const landing = new OrganismLandingPage(page);
    await landing.goto("bacteria");

    const pill = page.getByRole("button", { name: /Views:/ });
    await expect(pill).toBeVisible();

    // Open the sheet, then close it by clicking the X button (focus is restored to the trigger
    // programmatically — this is where the old focus-within bug fired)
    await pill.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Scroll down — pill must still hide even though trigger now has focus
    await page.getByTestId("landing-scroll-region").evaluate((element) => {
      element.scrollTo({ top: 300, behavior: "instant" });
    });
    const pillWrapper = page.locator("div.fixed.bottom-4");
    await expect(pillWrapper).toHaveCSS("opacity", "0", { timeout: 2000 });
  });
});

test.describe("bacteria organism landing page", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        {
          url: /\/api\/e2e-mock\/data\/genome\/\?.*limit\(1\)$/,
          method: "GET",
          body: [],
          headers: { "Content-Range": "items 0-0/0" },
        },
        ...workspaceOverrides,
        ...genomeScenarioOverrides,
        ...emptyBackendFallbackOverrides,
      ],
    });
  });

  test("renders the curated overview and shared taxonomy views", async ({ page }) => {
    const landing = new OrganismLandingPage(page);

    await landing.goto("bacteria");

    await expect(page.getByRole("heading", { level: 1, name: "Bacteria" })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toHaveCount(0);
    await expect(landing.getKpi("Genomes")).toContainText("1,337,420");
    await expect(landing.getGenusCard("Escherichia")).toContainText("128,450 genomes");
    await landing.expectDonut("Genus");
    await landing.expectDonut("Host Name");
    await landing.expectDonut("Isolation Country");

    await expect(page.getByRole("button", { name: /Phylogeny/ })).toHaveCount(0);

    await page.getByRole("button", { name: /Genomes/ }).click();
    await expect(page).toHaveURL(/\/organisms\/bacteria\?tab=genomes/);
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByText("Genome table filtering and pagination")).toHaveCount(0);
    await expect(page.locator("main")).toHaveCSS("padding-bottom", "0px");
    const fillShell = page.locator("main > div.flex-row");
    await expect.poll(async () =>
      fillShell.evaluate((element) => Math.round(element.getBoundingClientRect().bottom)),
    ).toBe(await page.evaluate(() => window.innerHeight));

    await page.goto("/organisms/bacteria?tab=phylogeny");
    await expect(page).toHaveURL(/\/organisms\/bacteria$/);
  });

  test("matches the visual snapshot", async ({ page }) => {
    const landing = new OrganismLandingPage(page);

    await landing.goto("bacteria");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("bacteria-organism-landing.png", {
      fullPage: true,
      timeout: 15_000,
    });
  });
});
