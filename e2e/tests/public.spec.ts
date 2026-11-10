import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  workspaceOverrides,
  emptyBackendFallbackOverrides,
} from "../fixtures/overrides";
import { SignInPage } from "../pages";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("public routes (no auth)", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...workspaceOverrides,
        ...emptyBackendFallbackOverrides,
      ],
    });
  });

  test("home page renders with navbar", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/DXKB|Disease X/i);
    await expect(page.locator("body")).toBeVisible();
  });

  test("/services index renders the services landing page", async ({ page }) => {
    await page.goto("/services");
    await expect(page).toHaveURL(/\/services\/?$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /services/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Genomics", exact: true }),
    ).toBeVisible();
  });

  // Every workspace route, public folders included, needs a signed-in user.
  for (const path of [
    "/workspace/public",
    "/workspace/public/ARWattam@patricbrc.org/BV-BRC%20Workshop",
    "/workspace/workshop",
  ]) {
    test(`${path} redirects to sign-in`, async ({ page }) => {
      await new SignInPage(page).gotoProtected(path);
    });
  }

  // Overscrolling past either edge (macOS rubber-banding) shows the canvas,
  // which paints the root element's background. A page that ends in the site
  // footer gives the root the footer's fill, so the bounce is not a white band.
  test("a page with the site footer paints the root in the footer's fill", async ({
    page,
  }) => {
    const fill = (element: Element) => getComputedStyle(element).backgroundColor;
    for (const path of ["/", "/about"]) {
      await page.goto(path);
      const footer = page.locator("[data-site-footer]");
      await expect(footer).toHaveCount(1);
      const footerFill = await footer.evaluate(fill);
      expect(await page.locator("html").evaluate(fill), path).toBe(footerFill);
      // The body keeps the page background over its own box.
      expect(await page.locator("body").evaluate(fill), path).not.toBe(
        footerFill,
      );
    }
  });

  test("footer pages render: /about, /contact, /faq", async ({ page }) => {
    for (const path of ["/about", "/contact", "/faq"]) {
      await page.goto(path);
      await expect(page, `expected ${path} to render`).toHaveURL(new RegExp(path));
    }
  });
});
