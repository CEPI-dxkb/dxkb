import { test, expect, applyBackendMocks } from "../../mocks/backends";
import {
  authSessionOverrides,
  workspaceOverrides,
  jobsOverrides,
  permissiveBackendOverrides,
} from "../../fixtures/overrides";

test.describe("visual regression", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspaceOverrides,
        ...jobsOverrides,
        ...permissiveBackendOverrides,
      ],
    });
  });

  test("home page matches snapshot", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("home.png", { fullPage: true, timeout: 15_000 });
  });

  test("sign-in page matches snapshot", async ({ page, context }) => {
    await context.clearCookies();
    // authSessionOverrides in beforeEach mocks a logged-in user, which would make
    // useAuth() report authenticated and redirect the sign-in page to `/`. Register
    // an unauthenticated response here so the sign-in form actually renders.
    const unauthenticated = {
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: null }),
    };
    await page.route("**/api/auth/get-session", (route) => route.fulfill(unauthenticated));
    await page.route("**/api/auth/profile", (route) => route.fulfill(unauthenticated));
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
    await expect(page).toHaveScreenshot("genome-assembly.png", { fullPage: true });
  });

  test("jobs page matches snapshot", async ({ page }) => {
    await page.goto("/jobs");
    await page.waitForLoadState("networkidle");
    // Jobs table has a live-updating "duration" cell for running jobs → ~1% pixel drift is expected.
    await expect(page).toHaveScreenshot("jobs.png", { fullPage: true, maxDiffPixelRatio: 0.02 });
  });
});
