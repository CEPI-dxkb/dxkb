/**
 * WCAG 2.3.3 / prefers-reduced-motion — asserts the app honours
 * `prefers-reduced-motion: reduce` and suppresses CSS transitions/animations.
 *
 * The a11y playwright config already sets `contextOptions.reducedMotion: "reduce"`
 * globally so every page load runs with the media query active. These tests
 * verify the CSS actually respects that setting on a known animated surface.
 */
import { test, expect, applyBackendMocks } from "../../mocks/backends";
import {
  authSessionOverrides,
  workspacePopulatedOverrides,
  a11yBackendOverrides,
} from "../../fixtures/overrides";

// Minimum duration (ms) below which we consider a transition "suppressed".
// CSS transitions with duration === 0 are interpreted as "no animation".
const suppressedDurationMs = 50;

async function getMotionDurations(
  page: Parameters<typeof applyBackendMocks>[0],
  selector: string,
): Promise<number[]> {
  return page.evaluate((sel: string) => {
    const el = document.querySelector(sel);
    if (!el) return [];
    const style = window.getComputedStyle(el);
    const parse = (raw: string) =>
      (raw || "0s")
        .split(",")
        .map((d) => parseFloat(d) * (d.includes("ms") ? 1 : 1000));
    return [
      ...parse(style.transitionDuration),
      ...parse(style.animationDuration),
    ];
  }, selector);
}

test.describe("prefers-reduced-motion", () => {
  test("workspace browser: sidebar + file rows have no long transitions when reduced-motion active", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspacePopulatedOverrides,
        ...a11yBackendOverrides,
      ],
    });
    await page.goto("/workspace");
    await page.waitForURL(/\/workspace\/[^/]+\/home/, { timeout: 10_000 });
    await page.waitForLoadState("networkidle");

    // The contextOptions.reducedMotion: "reduce" in playwright.a11y.config.ts sets
    // the media query at the browser-context level before this page loads.
    const mediaReducedMotion = await page.evaluate(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    expect(
      mediaReducedMotion,
      "reducedMotion context option should activate the media query",
    ).toBe(true);

    // Verify the workspace sidebar does not have long CSS transitions.
    const sidebarDurations = await getMotionDurations(
      page,
      "aside, nav, [data-sidebar]",
    );
    const longTransitions = sidebarDurations.filter(
      (d) => d > suppressedDurationMs,
    );
    expect(
      longTransitions,
      `Sidebar has CSS transitions exceeding ${String(suppressedDurationMs)}ms with reduced-motion active: ${longTransitions.join(", ")}ms`,
    ).toEqual([]);
  });

  test("home page: hero animations suppressed when reduced-motion active", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await applyBackendMocks(page, {
      overrides: [...a11yBackendOverrides],
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const mediaReducedMotion = await page.evaluate(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    expect(
      mediaReducedMotion,
      "reducedMotion context option should activate the media query",
    ).toBe(true);

    // Check main content wrapper for transition-duration and animation-duration overrides.
    const mainDurations = await getMotionDurations(
      page,
      "main, [class*='hero'], [class*='animate']",
    );
    const longMotion = mainDurations.filter((d) => d > suppressedDurationMs);
    expect(
      longMotion,
      `Home hero has transitions/animations exceeding ${String(suppressedDurationMs)}ms with reduced-motion active: ${longMotion.join(", ")}ms`,
    ).toEqual([]);
  });
});
