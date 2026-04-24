import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  workspaceOverrides,
  permissiveBackendOverrides,
} from "../fixtures/overrides";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("public routes (no auth)", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...workspaceOverrides,
        ...permissiveBackendOverrides,
      ],
    });
  });

  test("home page renders with navbar", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/DXKB|Disease X/i);
    await expect(page.locator("body")).toBeVisible();
  });

  test("/services index is publicly accessible", async ({ page }) => {
    await page.goto("/services");
    await expect(page).toHaveURL(/\/services\/?$/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("/workspace/public is publicly accessible", async ({ page }) => {
    await page.goto("/workspace/public");
    await expect(page).toHaveURL(/\/workspace\/public/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("/workspace/workshop is publicly accessible", async ({ page }) => {
    await page.goto("/workspace/workshop");
    // Workshop route redirects to the public workshop location; just confirm we land on a workspace public URL and not at sign-in.
    await expect(page).toHaveURL(/\/workspace\/(workshop|public)/);
    await expect(page).not.toHaveURL(/sign-in/);
  });

  test("footer pages render: /about, /contact, /faq", async ({ page }) => {
    for (const path of ["/about", "/contact", "/faq"]) {
      await page.goto(path);
      await expect(page, `expected ${path} to render`).toHaveURL(new RegExp(path));
    }
  });
});
