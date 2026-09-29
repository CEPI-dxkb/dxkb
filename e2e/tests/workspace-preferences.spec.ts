import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  journeyOverrides,
  workspacePopulatedOverrides,
} from "../fixtures/overrides";
import { WorkspacePage } from "../pages";
import { failOnRuntimeErrors } from "../support/runtime-errors";

test.describe("workspace preferences survive a refresh (signed in)", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [...workspacePopulatedOverrides, ...journeyOverrides],
    });
  });

  test("details panel keeps its dragged width", async ({ page }) => {
    const assertNoRuntimeErrors = failOnRuntimeErrors(page);
    const workspace = new WorkspacePage(page);
    await workspace.goto();
    await workspace.showDetailsPanel();
    const before = await workspace.panels.detailsWidth();
    await workspace.panels.dragSeparator(-300);
    const dragged = await workspace.panels.detailsWidth();
    expect(dragged).toBeGreaterThan(before + 200);

    await page.reload();
    await workspace.showDetailsPanel();
    await workspace.panels.expectDetailsWidth(dragged);
    assertNoRuntimeErrors();
  });
});
