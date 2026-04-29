import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  journeyOverrides,
  workspacePopulatedOverrides,
} from "../fixtures/overrides";

test.describe("workspace (signed in)", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        // Workspace.ls / Workspace.get / Workspace.list_permissions fired when loading workspace pages.
        ...workspacePopulatedOverrides,
        ...journeyOverrides,
      ],
    });
  });

  test("/workspace is not redirected to sign-in", async ({ page }) => {
    await page.goto("/workspace");
    await expect(page).not.toHaveURL(/sign-in/);
  });

  test("/workspace/home is not redirected to sign-in", async ({ page }) => {
    await page.goto("/workspace/home");
    await expect(page).not.toHaveURL(/sign-in/);
  });

  test("/workspace/[username]/home renders a workspace path", async ({ page }) => {
    await page.goto("/workspace/e2e-test-user@patricbrc.org/home");
    await expect(page).not.toHaveURL(/sign-in/);
    await expect(page).toHaveURL(/\/workspace\/.+\/home/);
  });

  test("/workspace/shared is not redirected to sign-in", async ({ page }) => {
    await page.goto("/workspace/shared");
    await expect(page).not.toHaveURL(/sign-in/);
  });

  test("/settings renders the User Settings heading", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).not.toHaveURL(/sign-in/);
    await expect(page.getByRole("heading", { level: 1, name: /user settings/i })).toBeVisible();
  });
});
