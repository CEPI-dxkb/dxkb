import type { Page } from "@playwright/test";

import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  buildJobsOverrides,
  emptyBackendFallbackOverrides,
  mockLifecycleJobs,
  workspaceOverrides,
  type MockJob,
} from "../fixtures/overrides";
import { Navbar } from "../pages/navbar";

// 768 is the floor in DXKBCORE-376; 1023/1024 is the desktop switch (lg), 1280 the inline
// search (xl), 1536 where the Advanced Search label is always full (2xl and up).
const widths = [768, 1023, 1024, 1100, 1279, 1280, 1366, 1536];
const pages = ["/", "/organisms/bacteria"];

// The default mocks answer the job summary with no jobs, and the header then shows no job
// pill. A signed-in header is widest with all four status groups in the pill (queued,
// running, completed, failed), so the signed-in specs serve one job of each.
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
        const banner = page.getByRole("banner").first();
        await expect(banner).toBeVisible();

        for (const name of ["Sign In", "Sign Up"]) {
          await expect(
            banner.getByRole("link", { name }).filter({ visible: true }),
          ).toBeInViewport({ ratio: 1 });
        }
        await expectNoSidewaysScroll(page, width);
      });
    }
  }

  test("the inline search keeps a usable text field at 1280px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/organisms/bacteria");
    const field = page
      .getByRole("banner")
      .getByRole("textbox")
      .filter({ visible: true });
    await expect(field).toBeVisible();
    expect((await field.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(150);
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
        const banner = page.getByRole("banner").first();
        await expect(banner).toBeVisible();

        // The pill loads after the page does; measure the header with it in place.
        const pill = new Navbar(page).jobStatusPill().filter({ visible: true });
        await expect(pill).toBeVisible();
        await expect(pill).toBeInViewport({ ratio: 1 });
        await expect(
          banner.getByRole("button", { name: "Account menu" }).filter({ visible: true }),
        ).toBeInViewport({ ratio: 1 });
        await expectNoSidewaysScroll(page, width);
      });
    }
  }

  test("the inline search keeps a usable text field at 1280px, label collapsed", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/organisms/bacteria");
    const banner = page.getByRole("banner");
    const field = banner.getByRole("textbox").filter({ visible: true });
    await expect(field).toBeVisible();
    // The job pill takes room from the field once it loads; measure with it in place.
    await expect(
      new Navbar(page).jobStatusPill().filter({ visible: true }),
    ).toBeVisible();
    // Before the collapse the field was 50-115px here.
    expect((await field.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(110);
    // The control is still there and still named, only its label is visually hidden.
    await expect(
      banner.getByRole("button", { name: "Advanced Search" }).filter({ visible: true }),
    ).toBeVisible();
  });
});
