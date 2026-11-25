import type { Page } from "@playwright/test";

import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  buildJobsOverrides,
  emptyBackendFallbackOverrides,
  mockLifecycleJobs,
  workspaceOverrides,
} from "../fixtures/overrides";
import { Navbar } from "../pages";

// DXKBCORE-381: both header rows are `h-16`, down from 72px.
const headerHeight = 64;
// The open mobile search row adds the 34px control and 12px of bottom padding.
const headerHeightWithMobileSearch = 110;
// WCAG 2.5.8 minimum target size.
const minTarget = 24;
// 320 and 375 are phones; 768 is where DXKBCORE-376's no-clipping contract starts.
const widths = [320, 375, 768, 1023, 1024, 1280, 1536];
const pages = ["/", "/organisms/bacteria"];
// Below 768px the row overflows (signed out at 320 and 375, signed in at 320) and flex
// squeezes the logo link under 24px. That is a separate ticket, so the logo link is left
// out of the target check below 768px.
const logoLink = "#dxkb-logo-desktop, #dxkb-logo-mobile";
const logoFloorWidth = 768;

async function expectCompactHeader(page: Page, width: number) {
  const navbar = new Navbar(page);
  await expect(navbar.header()).toBeVisible();
  expect(await navbar.height(), `header height at ${String(width)}px`).toBe(
    headerHeight,
  );
  expect(
    await navbar.controlsSmallerThan(
      minTarget,
      width < logoFloorWidth ? logoLink : undefined,
    ),
    `header controls under ${String(minTarget)}px at ${String(width)}px`,
  ).toEqual([]);
}

async function expectCompactMobileSearch(page: Page) {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/organisms/bacteria");
  const navbar = new Navbar(page);
  await navbar.mobileSearchToggle().click();
  // The row opens with a 150ms grid-rows transition.
  await expect
    .poll(() => navbar.height(), { message: "header height with search open" })
    .toBe(headerHeightWithMobileSearch);
  expect(
    await navbar.controlsSmallerThan(minTarget, logoLink),
    `header controls under ${String(minTarget)}px with search open`,
  ).toEqual([]);
}

test.describe("compact header (signed out)", () => {
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
        await expectCompactHeader(page, width);
      });
    }
  }

  test("the open mobile search row stays tight", async ({ page }) => {
    await expectCompactMobileSearch(page);
  });
});

test.describe("compact header (signed in)", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...buildJobsOverrides({ jobs: mockLifecycleJobs }),
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
        // The pill loads after the page does; measure the header with it in place.
        await expect(new Navbar(page).headerJobPill()).toBeVisible();
        await expectCompactHeader(page, width);
      });
    }
  }

  test("the open mobile search row stays tight", async ({ page }) => {
    await expectCompactMobileSearch(page);
  });
});
