import type { Locator } from "@playwright/test";

import { applyBackendMocks, expect, test } from "../mocks/backends";
import {
  e2eNoExperimentsTaxonId,
  emptyBackendFallbackOverrides,
  workspaceOverrides,
} from "../fixtures/overrides";
import { TaxonPage } from "../pages";

test.use({ storageState: { cookies: [], origins: [] } });

/**
 * Opens the taxon page and waits for the rail's data check to disable the
 * Experiments tab. The page renders through one Next server whose loopback
 * resets some of its dozens of concurrent reads when several workers load a
 * taxon at once, and a reset availability read fails open (every tab stays
 * enabled), so a miss reloads instead of failing the test.
 */
async function gotoWithDataCheck(
  taxon: TaxonPage,
  experiments: Locator,
): Promise<void> {
  await expect(async () => {
    await taxon.goto(e2eNoExperimentsTaxonId);
    await expect(experiments).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
}

test.describe("taxonomy rail: tabs with no data", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [...workspaceOverrides, ...emptyBackendFallbackOverrides],
    });
  });

  test("a data-disabled tab explains why on hover and on keyboard focus", async ({
    page,
  }) => {
    const taxon = new TaxonPage(page);
    const reason = "No experiments for this taxon.";
    const { tooltip } = taxon.viewNav;
    const experiments = taxon.viewNav.disabledTab("Experiments", reason);

    // The rail streams in after the data check, so the disabled tab appears
    // once it resolves; its tooltip handlers need the streamed rail hydrated.
    await gotoWithDataCheck(taxon, experiments);
    await taxon.viewNav.waitForHydration();

    await experiments.hover();
    await expect(tooltip).toHaveText(reason);

    await page.mouse.move(0, 0);
    await expect(tooltip).toHaveCount(0);

    // Epitopes is the enabled tab right before Experiments in the rail, and
    // the disabled tab's inner button is out of the tab order (`tabIndex=-1`),
    // so one Tab lands on its focusable wrapper.
    await taxon.viewNav.tab("Epitopes").focus();
    await page.keyboard.press("Tab");
    await expect(experiments).toBeFocused();
    await expect(tooltip).toHaveText(reason);
  });

  test("a tab with data stays enabled", async ({ page }) => {
    const taxon = new TaxonPage(page);
    // Epitopes is only meaningfully enabled once the data check has run, so
    // wait for the Experiments tab it disables.
    await gotoWithDataCheck(
      taxon,
      taxon.viewNav.disabledTab("Experiments", "No experiments for this taxon."),
    );
    await expect(taxon.viewNav.tab("Epitopes")).toBeVisible();
    await expect(taxon.viewNav.tab("Epitopes")).not.toHaveAttribute(
      "aria-disabled",
    );
  });
});
