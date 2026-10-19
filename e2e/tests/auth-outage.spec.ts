import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  journeyOverrides,
  workspacePopulatedOverrides,
} from "../fixtures/overrides";

// The loopback identity mock answers this user's profile lookup with a 503
// maintenance page (src/app/api/e2e-mock/[...path]/identity.ts), as the BV-BRC
// user service did during the 2026-10-19 maintenance window.
const outageUserId = "e2e-outage-user@patricbrc.org";

test.describe("profile service outage", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error("baseURL must be configured");
    const domain = new URL(baseURL).hostname;
    const cookie = {
      path: "/",
      domain,
      httpOnly: true,
      secure: false,
      sameSite: "Strict" as const,
    };
    await context.addCookies([
      {
        ...cookie,
        name: "bvbrc_token",
        value: `un=${outageUserId}|e2e-outage-token`,
      },
      { ...cookie, name: "bvbrc_user_id", value: outageUserId },
      { ...cookie, name: "bvbrc_realm", value: "patricbrc.org" },
    ]);
    await applyBackendMocks(page, {
      overrides: [...workspacePopulatedOverrides, ...journeyOverrides],
    });
  });

  test("keeps a signed-in user on a protected page and explains the outage", async ({
    page,
  }) => {
    await page.goto("/jobs");

    await expect(page).toHaveURL(/\/jobs$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /^jobs$/i }),
    ).toBeVisible();
    const notice = page.getByRole("status", {
      name: /couldn.t verify your account/i,
    });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("HTTP 503");
    await expect(notice).not.toContainText("maintenance</h1>");
    await expect(page.getByRole("link", { name: "Sign In" })).toBeHidden();

    await notice.getByRole("button", { name: "Dismiss" }).click();
    await expect(notice).toBeHidden();
  });

  test("returns a user bounced to sign-in to their page", async ({ page }) => {
    await page.goto("/sign-in?redirect=%2Fjobs");

    await expect(page).toHaveURL(/\/jobs$/);
  });
});
