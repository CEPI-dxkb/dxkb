import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  journeyOverrides,
  workspacePopulatedOverrides,
} from "../fixtures/overrides";
import { JobsListPage } from "../pages";
import { failOnRuntimeErrors } from "../support/runtime-errors";

test.describe("jobs preferences survive a refresh (signed in)", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [...workspacePopulatedOverrides, ...journeyOverrides],
    });
  });

  test("details panel keeps its dragged width", async ({ page }) => {
    const assertNoRuntimeErrors = failOnRuntimeErrors(page);
    const jobs = new JobsListPage(page);
    await jobs.goto();
    await expect(jobs.panels.separator).toBeVisible();
    await jobs.panels.settle();
    const before = await jobs.panels.detailsWidth();
    await jobs.panels.dragSeparator(-200);
    const dragged = await jobs.panels.detailsWidth();
    expect(dragged).toBeGreaterThan(before + 100);

    await page.reload();
    await jobs.panels.settle();
    await jobs.panels.expectDetailsWidth(dragged);
    assertNoRuntimeErrors();
  });
});
