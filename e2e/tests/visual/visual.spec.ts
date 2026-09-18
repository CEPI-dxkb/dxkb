import { test, expect, applyBackendMocks } from "../../mocks/backends";
import {
  authSessionOverrides,
  workspaceOverrides,
  jobsOverrides,
  emptyBackendFallbackOverrides,
} from "../../fixtures/overrides";

test.describe("visual regression", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspaceOverrides,
        ...jobsOverrides,
        ...emptyBackendFallbackOverrides,
      ],
    });
  });

  test("home page matches snapshot", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("home.png", {
      fullPage: true,
      timeout: 15_000,
    });
  });

  test("sign-in page matches snapshot", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/sign-in");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("sign-in.png", { fullPage: true });
  });

  test("workspace browser matches snapshot", async ({ page }) => {
    await page.goto("/workspace");
    await page.waitForURL(/\/workspace\/[^/]+\/home/, { timeout: 10_000 });
    // Wait for the WorkspaceBrowser toolbar to hydrate so Firefox doesn't snapshot the pre-hydration navbar-only state.
    await page.getByPlaceholder(/Search files/).waitFor({ timeout: 10_000 });
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("workspace.png", { fullPage: true });
  });

  test("genome-assembly form matches snapshot", async ({ page }) => {
    await page.goto("/services/genome-assembly");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("genome-assembly.png", {
      fullPage: true,
    });
  });

  test("jobs page matches snapshot", async ({ page }) => {
    await page.goto("/jobs");
    await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0);
    await expect(page.getByText("job-001", { exact: true })).toBeVisible();
    await expect(page.getByText("job-002", { exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot("jobs.png", {
      fullPage: true,
      mask: [page.getByTestId("jobs-last-updated")],
    });
  });
});
