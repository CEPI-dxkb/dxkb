import type { Page } from "@playwright/test";

import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  buildJobsOverrides,
  emptyBackendFallbackOverrides,
  mockLifecycleJobs,
  workspaceOverrides,
  type MockJob,
} from "../fixtures/overrides";
import { Navbar } from "../pages";

// 768 is the floor in DXKBCORE-376; 1023/1024 is the desktop switch (lg), 1280 the inline
// search (xl), 1536 a wide desktop where even a signed-in header keeps the full label.
const widths = [768, 1023, 1024, 1100, 1279, 1280, 1366, 1536];
const pages = ["/", "/organisms/bacteria"];

// The "Advanced Search" button is about 59px with its label collapsed to an icon and about
// 158px with the full label; these bounds split the two with room on each side.
const collapsedAdvancedMaxWidth = 90;
const fullAdvancedMinWidth = 120;

// The default mocks answer the job summary with no jobs, and the header then shows no job
// pill. The signed-in specs serve one job of each status (queued, running, completed,
// failed), so the pill shows all four groups, each with a single-digit count. Real accounts
// with multi-digit counts get a slightly narrower text field; the 110px floor below leaves
// headroom for that.
const failedJob: MockJob = {
  id: "job-failed",
  app: "GenomeAssembly2",
  status: "failed",
  submit_time: "2026-04-20T05:00:00Z",
  owner: "e2e-test-user",
  parameters: {},
};
const jobPillOverrides = buildJobsOverrides({
  jobs: [...mockLifecycleJobs, failedJob],
});

async function expectNoSidewaysScroll(page: Page, width: number) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `page scrolls sideways at ${String(width)}px`).toBeLessThanOrEqual(0);
}

test.describe("header never clips from 768px up (signed out)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [...workspaceOverrides, ...emptyBackendFallbackOverrides],
    });
  });

  for (const path of pages) {
    for (const width of widths) {
      test(`${path} at ${String(width)}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(path);
        const navbar = new Navbar(page);
        await expect(navbar.header()).toBeVisible();

        for (const link of [navbar.signInLink(), navbar.signUpLink()]) {
          await navbar.expectFullyInViewport(link);
        }
        await expectNoSidewaysScroll(page, width);
      });
    }
  }

  test("the inline search keeps a usable text field at 1280px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/organisms/bacteria");
    const navbar = new Navbar(page);
    const field = navbar.searchField();
    await expect(field).toBeVisible();
    expect((await navbar.widthOf(field)) ?? 0).toBeGreaterThanOrEqual(150);
    // Nothing narrows the row, so the "Advanced Search" label stays in full.
    const advanced = navbar.advancedSearchButton();
    await expect(advanced).toBeVisible();
    expect((await navbar.widthOf(advanced)) ?? 0).toBeGreaterThan(
      fullAdvancedMinWidth,
    );
  });
});

test.describe("header never clips from 768px up (signed in)", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...jobPillOverrides,
        ...workspaceOverrides,
        ...emptyBackendFallbackOverrides,
      ],
    });
  });

  for (const path of pages) {
    for (const width of widths) {
      test(`${path} at ${String(width)}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(path);
        const navbar = new Navbar(page);
        await expect(navbar.header()).toBeVisible();

        // The pill loads after the page does; measure the header with it in place.
        const pill = navbar.headerJobPill();
        await expect(pill).toBeVisible();
        await navbar.expectFullyInViewport(pill);
        await navbar.expectFullyInViewport(navbar.accountMenu());
        await expectNoSidewaysScroll(page, width);
      });
    }
  }

  test("the inline search keeps a usable text field at 1280px, label collapsed", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/organisms/bacteria");
    const navbar = new Navbar(page);
    const field = navbar.searchField();
    await expect(field).toBeVisible();
    // The job pill takes room from the field once it loads; measure with it in place.
    await expect(navbar.headerJobPill()).toBeVisible();
    // Before the collapse the field was 50-115px here.
    expect((await navbar.widthOf(field)) ?? 0).toBeGreaterThanOrEqual(110);
    // The control is still there and still named, only its label is visually hidden.
    // The label is `sr-only`, which Playwright still counts as visible, so the collapse
    // shows in the button's width: about 59px collapsed, 158px with the full label.
    const advanced = navbar.advancedSearchButton();
    await expect(advanced).toBeVisible();
    expect((await navbar.widthOf(advanced)) ?? Infinity).toBeLessThan(
      collapsedAdvancedMaxWidth,
    );
  });
});
