import { test, expect, applyBackendMocks } from "../../mocks/backends";
import {
  authSessionOverrides,
  workspaceOverrides,
  jobsOverrides,
  permissiveBackendOverrides,
} from "../../fixtures/overrides";

test.describe("phylogenomics services", () => {
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

  test("viral-genome-tree form renders with h1", async ({ page }) => {
    await page.goto("/services/viral-genome-tree");
    await expect(page).not.toHaveURL(/sign-in/);
    await expect(
      page.getByRole("heading", { level: 1, name: /viral genome tree/i }),
    ).toBeVisible();
  });
});
