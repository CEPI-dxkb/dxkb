import type { Page } from "@playwright/test";

import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  journeyOverrides,
  signInDuringOutage,
  workspacePopulatedOverrides,
} from "../fixtures/overrides";
import { JobsListPage } from "../pages";

// The session's profile lookup reaches a user service in an outage
// (src/lib/e2e-fixtures/outages.ts), as the BV-BRC user service was during the
// 2026-10-19 maintenance window: the loopback answers it with a 503
// maintenance page, or never answers at all.

function sessionNotice(page: Page) {
  return page.getByRole("status", { name: /couldn.t verify your account/i });
}

test.describe("profile service outage", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [...workspacePopulatedOverrides, ...journeyOverrides],
    });
  });

  test.describe("maintenance page", () => {
    test.beforeEach(async ({ context, baseURL }) => {
      await signInDuringOutage(context, baseURL, { user: "maintenance" });
    });

    test("keeps a signed-in user on a protected page and explains the outage", async ({
      page,
    }) => {
      await new JobsListPage(page).goto();

      await expect(page).toHaveURL(/\/jobs$/);
      const notice = sessionNotice(page);
      await expect(notice).toBeVisible();
      await expect(notice).toContainText("HTTP 503");
      await expect(notice).not.toContainText("</");
      await expect(page.getByRole("link", { name: "Sign In" })).toBeHidden();

      await notice.getByRole("button", { name: "Dismiss" }).click();
      await expect(notice).toBeHidden();
    });

    test("returns a user bounced to sign-in to their page", async ({ page }) => {
      await page.goto("/sign-in?redirect=%2Fjobs");

      await expect(page).toHaveURL(/\/jobs$/);
    });
  });

  test.describe("lookup that never answers", () => {
    test.beforeEach(async ({ context, baseURL }) => {
      await signInDuringOutage(context, baseURL, { user: "hang" });
    });

    test("keeps the user signed in once the lookup's budget runs out", async ({
      page,
    }) => {
      // Every render waits out the lookup's 5 s budget before it answers.
      test.slow();
      await new JobsListPage(page).goto();

      const notice = sessionNotice(page);
      await expect(notice).toBeVisible();
      await expect(notice).toContainText("did not respond");
      await expect(page.getByRole("link", { name: "Sign In" })).toBeHidden();
    });
  });
});
