import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  journeyOverrides,
  workspacePopulatedOverrides,
} from "../fixtures/overrides";

test.describe("jobs page", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        // Workspace.get (favorites) fired when /jobs page loads the workspace sidebar chrome.
        ...workspacePopulatedOverrides,
        ...journeyOverrides,
      ],
    });
  });

  test("renders the Jobs heading for signed-in user", async ({ page }) => {
    await page.goto("/jobs");
    await expect(page).not.toHaveURL(/sign-in/);
    await expect(page.getByRole("heading", { level: 1, name: /^jobs$/i })).toBeVisible();
  });
});
