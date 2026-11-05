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

  test("the jobs table keeps a dragged column width across a refresh", async ({
    page,
  }) => {
    const assertNoRuntimeErrors = failOnRuntimeErrors(page);
    const jobs = new JobsListPage(page);
    await jobs.goto();
    await jobs.waitForJob("job-001");
    // Service is not the first column, so nothing pins its width.
    const before = await jobs.columnWidth("Service");
    const left = await jobs.columnLeft("Service");
    // The edge follows the pointer to within half a setting step: the table
    // stretches its settings by `scale` to fill the pane.
    const setting = await jobs.columnSetting("Service");
    expect(setting).toBeGreaterThan(0);
    const tolerance = before / setting / 2 + 1;
    await jobs.dragColumnHandle("Service", 120);
    await expect
      .poll(async () =>
        Math.abs((await jobs.columnWidth("Service")) - before - 120),
      )
      .toBeLessThanOrEqual(tolerance);
    // The columns before it do not move.
    expect(
      Math.abs((await jobs.columnLeft("Service")) - left),
    ).toBeLessThanOrEqual(1);
    const dragged = await jobs.columnWidth("Service");

    await page.reload();
    await jobs.waitForJob("job-001");
    await jobs.expectColumnWidth("Service", dragged);
    assertNoRuntimeErrors();
  });
});
