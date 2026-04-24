import { test, expect, applyBackendMocks } from "../../mocks/backends";
import {
  authSessionOverrides,
  workspaceOverrides,
  jobsOverrides,
  permissiveBackendOverrides,
} from "../../fixtures/overrides";

test.describe("utilities services", () => {
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

  test("fastq-utilities form renders with h1", async ({ page }) => {
    await page.goto("/services/fastq-utilities");
    await expect(page).not.toHaveURL(/sign-in/);
    await expect(
      page.getByRole("heading", { level: 1, name: /fastq utilities/i }),
    ).toBeVisible();
  });
});
