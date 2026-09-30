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
    await jobs.waitForRows();
    // Service is not the first column, so nothing pins its width.
    const before = await jobs.columnSize("Service");
    await jobs.dragColumnHandle("Service", 120);
    // The pointer drag lands a render or two after mouse-up; wait for it, then
    // take the rendered width. (Not `before + 120` of the rendered width: the
    // table stretches to fill its pane until the columns outgrow it.)
    await expect.poll(() => jobs.columnSize("Service")).toBe(before + 120);
    const dragged = await jobs.columnWidth("Service");

    await page.reload();
    await jobs.waitForRows();
    await jobs.expectColumnWidth("Service", dragged);
    assertNoRuntimeErrors();
  });
});
