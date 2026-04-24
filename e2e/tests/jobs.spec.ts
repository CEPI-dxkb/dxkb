import { test, expect } from "@playwright/test";
import { applyBackendMocks } from "../mocks/backends";
import {
  authSessionOverrides,
  workspaceOverrides,
  jobsOverrides,
  permissiveBackendOverrides,
} from "../fixtures/overrides";

test.describe("jobs page", () => {
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

  test("renders the Jobs heading for signed-in user", async ({ page }) => {
    await page.goto("/jobs");
    await expect(page).not.toHaveURL(/sign-in/);
    await expect(page.getByRole("heading", { level: 1, name: /^jobs$/i })).toBeVisible();
  });
});
