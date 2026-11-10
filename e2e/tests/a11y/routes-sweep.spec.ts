import { test, expect, applyBackendMocks } from "../../mocks/backends";
import {
  authSessionOverrides,
  workspaceOverrides,
  jobsOverrides,
  copilotOverrides,
  a11yBackendOverrides,
  circularViewerFixture,
  circularViewerScenarioOverrides,
} from "../../fixtures/overrides";
import { awaitSettled } from "../../a11y/settle";
import { scanPage, formatBlocking, logWarnings } from "../../a11y/axe-scan";
import { partition } from "../../a11y/gate";
import type { Violation } from "../../a11y/gate";
import { applyBaseline } from "../../a11y/baseline";
import { forEachTheme } from "../../a11y/theme";
import generatedBaseline, { reflowSkip } from "../../a11y/baseline.generated";
import { isReflowSkipped } from "../../a11y/baseline";
import { recordScan } from "../../a11y/report";
import {
  CircularViewerPanelPage,
  CompareRegionPage,
  GenomeBrowserPanelPage,
} from "../../pages";
import {
  densitySpecs,
  labelWidthFor,
  plotWidthFor,
} from "@/lib/compare-region/density";
import { scanTargets } from "../../a11y/routes";
import type { BaselineMap } from "../../a11y/baseline";
import type { RouteEntry } from "../../a11y/routes";
import type { Page } from "@playwright/test";
import type { JsonOverride } from "../../mocks/backends";
import { mockAuspiceBasemap } from "../../fixtures/overrides/auspice-basemap";
import { hasWebGl } from "../../support/webgl";
import auspiceDataset from "../../fixtures/overrides/organisms/phylogeny/auspice-tree-map-v2.json" with { type: "json" };

const auspiceDatasetId = "Influenza-A-Virus/H3N2/HA";

const baselineMap: BaselineMap = generatedBaseline;

const genomeBrowserSelector = '[data-testid="genome-browser"]';

const compareRegionCardSelector = 'section[aria-label="Compare regions"]';

/**
 * The `color-contrast` violations of a page scan, filtered to nodes inside `selector`,
 * so no second axe pass runs (each costs 5–7 s on CI WebKit).
 */
async function contrastInside(
  page: Page,
  violations: Violation[],
  selector: string,
): Promise<Violation[]> {
  const inside: Violation[] = [];
  for (const violation of violations) {
    if (violation.id !== "color-contrast") continue;
    const within = await page.evaluate(
      ({ root, targets }) => {
        const container = document.querySelector(root);
        return targets.map((target) => {
          // A top-document node has a one-selector target; iframe or shadow-root nodes
          // have more.
          if (target.length !== 1 || typeof target[0] !== "string") {
            return false;
          }
          const element = document.querySelector(target[0]);
          return (
            container !== null && element !== null && container.contains(element)
          );
        });
      },
      { root: selector, targets: violation.nodes.map((node) => node.target) },
    );
    const nodes = violation.nodes.filter((_, index) => within[index]);
    if (nodes.length > 0) inside.push({ ...violation, nodes });
  }
  return inside;
}

/**
 * Asserts no `color-contrast` violation inside the Compare Region card, outright rather
 * than via the wildcard baseline.
 */
async function expectCompareRegionContrast(
  page: Page,
  violations: Violation[],
  context: string,
): Promise<void> {
  const contrast = await contrastInside(
    page,
    violations,
    compareRegionCardSelector,
  );
  expect(
    contrast,
    contrast.length === 0
      ? undefined
      : formatBlocking(contrast, `the Compare Region card (${context})`),
  ).toEqual([]);
}

/**
 * Asserts no HTML `color-contrast` violation in the Circular Viewer panel; axe leaves
 * SVG text incomplete, so position labels are covered by `theme-contrast.test.ts`.
 */
async function expectCircularViewerContrast(
  page: Page,
  context: string,
): Promise<void> {
  const contrast = (
    await scanPage(page, { include: '[data-testid="circular-viewer"]' })
  ).filter((violation) => violation.id === "color-contrast");
  expect(
    contrast,
    contrast.length === 0
      ? undefined
      : formatBlocking(contrast, `the Circular Viewer panel (${context})`),
  ).toEqual([]);
}

/**
 * Scans a Genome Browser tab in both themes: the host page with the browser excluded,
 * then the JBrowse subtree. Assertions are callbacks so callers pass scan keys to
 * `assertNoBlockingViolations` as string literals, the only form `extractScannedKeys`
 * counts.
 */
async function scanGenomeBrowserTab(
  page: Page,
  path: string,
  assertHost: (violations: Violation[], theme: string) => void,
  assertBrowser: (violations: Violation[], theme: string) => void,
): Promise<void> {
  await page.goto(path);
  await awaitSettled(page);
  const browser = new GenomeBrowserPanelPage(page);
  await browser.expectLoaded();
  await forEachTheme(page, async (theme) => {
    await browser.expectPaintedWithAppliedTheme();
    await browser.expectLoaded();
    assertHost(
      await scanPage(page, { exclude: [genomeBrowserSelector] }),
      theme,
    );
    const browserViolations = await scanPage(page, {
      include: genomeBrowserSelector,
      disableRules: [
        // JBrowse 5.0.0-beta.20's icon-only MUI header buttons (view menu, zoom menu)
        // have no aria-label.
        "button-name",
        // The header zoom slider's hidden range input has no accessible name.
        "label",
      ],
    });
    const contrast = browserViolations.filter(
      (violation) => violation.id === "color-contrast",
    );
    expect(
      contrast,
      contrast.length === 0
        ? undefined
        : formatBlocking(contrast, `the Genome Browser subtree (${theme})`),
    ).toEqual([]);
    assertBrowser(browserViolations, theme);
  });
}

function assertNoBlockingViolations(
  violations: Violation[],
  routeKey: string,
  theme: string,
): void {
  const { blocking, warnings } = partition(violations);
  const { remaining, suppressed } = applyBaseline(
    baselineMap,
    routeKey,
    theme,
    blocking,
  );
  logWarnings(warnings, `${routeKey} (${theme})`);
  if (suppressed.length > 0) {
    console.info(
      `[a11y] ${routeKey} (${theme}): ${String(suppressed.length)} suppressed by baseline`,
    );
  }
  recordScan({
    project: test.info().project.name,
    route: routeKey,
    theme,
    retry: test.info().retry,
    blocking: remaining,
    suppressed,
    warnings,
  });
  expect(
    remaining,
    remaining.length === 0
      ? undefined
      : formatBlocking(remaining, `${routeKey} (${theme})`),
  ).toEqual([]);
}

async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
}

function buildOverrides(route: RouteEntry): JsonOverride[] {
  if (route.unauthenticated) {
    return [...a11yBackendOverrides];
  }
  return [
    ...authSessionOverrides,
    ...(route.needsWorkspace ? workspaceOverrides : []),
    ...(route.needsJobs ? jobsOverrides : []),
    ...(route.needsCopilot ? copilotOverrides : []),
    ...a11yBackendOverrides,
  ];
}

test.describe("a11y route sweep", () => {
  for (const target of scanTargets) {
    test(`${target.name} (${target.path}) has no blocking a11y violations`, async ({
      page,
      context,
    }, testInfo) => {
      if (
        testInfo.project.name.includes("tripwire") &&
        !target.route.tripwire
      ) {
        test.skip();
      }
      if (testInfo.project.name.includes("mobile") && !target.route.mobile) {
        test.skip();
      }
      if (target.route.unauthenticated) {
        await context.clearCookies();
      }

      await applyBackendMocks(page, {
        overrides: buildOverrides(target.route),
      });
      await page.goto(target.path);
      await awaitSettled(page, target.route.settle);
      await target.prepare?.(page);

      await forEachTheme(page, async (theme) => {
        const violations = await scanPage(page);
        assertNoBlockingViolations(violations, target.name, theme);
      });

      await page.setViewportSize({ width: 320, height: 568 });
      const scrolls = await hasHorizontalScroll(page);
      if (isReflowSkipped(reflowSkip, target.name)) {
        if (scrolls) {
          const ticket = reflowSkip[target.name]?.ticket ?? "unknown";
          console.warn(
            `[a11y/reflow-skip] ${target.name}: horizontal scroll suppressed (${ticket})`,
          );
        }
      } else {
        expect(
          scrolls,
          `${target.name}: horizontal scroll at 320px viewport — WCAG 1.4.10 reflow failure`,
        ).toBe(false);
      }
    });
  }
});

test.describe("a11y component surfaces", () => {
  test("taxonomy metadata-distributions has no regression in fixed WCAG rules", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await applyBackendMocks(page, {
      overrides: [...workspaceOverrides, ...a11yBackendOverrides],
    });
    await page.goto("/taxonomy/234");

    await page
      .getByRole("heading", { level: 2, name: /Metadata Distributions/ })
      .waitFor({ timeout: 10_000 });
    await page.waitForLoadState("networkidle");

    const violations = await scanPage(page, {
      include: '[data-testid="metadata-distributions"]',
    });

    const lockedRules = new Set([
      "label-content-name-mismatch",
      "aria-toggle-field-name",
      "non-text-contrast",
      "heading-order",
    ]);
    const regressions = violations.filter((v) => lockedRules.has(v.id));
    expect(
      regressions,
      regressions.length === 0
        ? undefined
        : `${String(regressions.length)} WCAG regression(s) in metadata-distributions:\n${regressions
            .map(
              (v) =>
                `  - ${v.id}: ${v.help} (${String(v.nodes.length)} node(s))`,
            )
            .join("\n")}`,
    ).toEqual([]);

    assertNoBlockingViolations(
      violations,
      "taxonomy-metadata-distributions",
      "dxkb-light",
    );
  });

  test("command palette (open) has no blocking a11y violations", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspaceOverrides,
        ...jobsOverrides,
        ...a11yBackendOverrides,
      ],
    });
    await page.goto("/jobs");
    await page.waitForLoadState("networkidle");

    const modifierKey = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifierKey}+K`);
    const commandPaletteDialog = page.getByRole("dialog", {
      name: /command palette/i,
    });
    // WebKit on Linux CI swallows Ctrl+K as an Emacs shortcut; retry with Meta+K.
    try {
      await commandPaletteDialog.waitFor({ state: "visible", timeout: 3_000 });
    } catch {
      await page.keyboard.press("Meta+K");
      await commandPaletteDialog.waitFor({ state: "visible", timeout: 10_000 });
    }
    // On WebKit the theme CSS variables can lag behind dialog visibility, causing false
    // color-contrast hits; input auto-focus confirms full mount.
    await expect(page.locator('[data-slot="command-input"]')).toBeFocused({
      timeout: 5_000,
    });

    const violations = await scanPage(page);
    assertNoBlockingViolations(violations, "command-palette", "dxkb-light");
  });

  // Lives here, not in routes[], because the viewer needs charon and map-tile mocks
  // that buildOverrides() cannot express.
  test("auspice viewer has no blocking a11y violations", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await applyBackendMocks(page, {
      overrides: [
        {
          url: /\/api\/content\/phyloxml_trees\/families\/2955291\/2955291\.json$/,
          body: {
            order: ["h3n2"],
            groups: [
              {
                key: "h3n2",
                title: "H3N2",
                archaeopteryx: [],
                nextstrain: [
                  { name: "H3N2 segment 4 (HA)", path: auspiceDatasetId },
                ],
              },
            ],
          },
        },
        {
          url: "/api/phylogeny/nextstrain-datasets",
          body: { ids: [auspiceDatasetId] },
        },
        {
          url: "/api/charon/getAvailable",
          body: { datasets: [], narratives: [] },
        },
        {
          url: /\/api\/charon\/getDataset\?.*type=(root-sequence|tip-frequencies|measurements)/,
          status: 404,
          body: { error: "dataset not found" },
        },
        { url: "/api/charon/getDataset", body: auspiceDataset },
        ...a11yBackendOverrides,
      ],
    });
    await mockAuspiceBasemap(page);

    await page.goto("/taxonomy/2955291?tab=phylogeny");
    await page
      .getByRole("heading", { name: "Available phylogenetic trees" })
      .waitFor();

    await forEachTheme(page, async (theme) => {
      const violations = await scanPage(page);
      assertNoBlockingViolations(violations, "auspice-picker", theme);
    });

    await page
      .getByRole("button", { name: "Open H3N2 segment 4 (HA) in Auspice" })
      .click();

    const viewer = page.frameLocator('iframe[title*="Auspice"]');
    await viewer
      .getByText("Deterministic H3N2 Auspice tree", { exact: true })
      .waitFor({
        timeout: 30_000,
      });
    await viewer.getByText(/Powered by Nextstrain/).waitFor();
    // Without WebGL (headless Firefox in CI) Auspice renders no map panel.
    if (await hasWebGl(page)) await viewer.locator("#map").waitFor();

    // The bridge mirrors the host theme into the iframe, so each theme scan exercises
    // both token sets.
    const auspiceFrameSelector = 'iframe[title*="Auspice"]';
    await forEachTheme(page, async (theme) => {
      const hostViolations = await scanPage(page, {
        exclude: [auspiceFrameSelector],
      });
      assertNoBlockingViolations(hostViolations, "auspice-viewer-host", theme);

      // Two rules are disabled for this subtree only, for upstream Auspice defects;
      // both are critical-impact, which the baseline refuses.
      const iframeViolations = await scanPage(page, {
        include: auspiceFrameSelector,
        disableRules: [
          // react-select's hidden dummyInput has role=combobox and no accessible name.
          "label",
          // Auspice's zoom toolbar buttons have no discernible text.
          "button-name",
        ],
      });
      assertNoBlockingViolations(
        iframeViolations,
        "auspice-viewer-iframe",
        theme,
      );
    });
  });

  // Lives here because one page.tsx can be claimed by a single entry
  // (coverage.meta.spec.ts).
  test("genome browser tab has no blocking a11y violations", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await applyBackendMocks(page, { overrides: [...a11yBackendOverrides] });
    await scanGenomeBrowserTab(
      page,
      "/genome/1282460.2049?tab=genome-browser",
      (violations, theme) => {
        assertNoBlockingViolations(violations, "genome-browser-host", theme);
      },
      (violations, theme) => {
        assertNoBlockingViolations(violations, "genome-browser-view", theme);
      },
    );
  });

  test("circular viewer tab has no blocking a11y violations", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await applyBackendMocks(page, {
      overrides: [...circularViewerScenarioOverrides, ...a11yBackendOverrides],
    });
    const viewer = new CircularViewerPanelPage(page);
    await viewer.goto(circularViewerFixture.genomeId);
    await awaitSettled(page);
    // Every default track settled, so scanned nodes do not depend on in-flight answers.
    await viewer.expectDefaultTracksSettled();
    await forEachTheme(page, async (theme) => {
      assertNoBlockingViolations(await scanPage(page), "circular-viewer", theme);
      await expectCircularViewerContrast(page, theme);
    });
  });

  test("feature browser tab has no blocking a11y violations", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await applyBackendMocks(page, { overrides: [...a11yBackendOverrides] });
    await scanGenomeBrowserTab(
      page,
      "/feature/PATRIC.1282460.2049.JX869059.CDS.1.100.fwd?tab=genome-browser",
      (violations, theme) => {
        assertNoBlockingViolations(violations, "feature-browser-host", theme);
      },
      (violations, theme) => {
        assertNoBlockingViolations(violations, "feature-browser-view", theme);
      },
    );
  });

  test("feature compare region tab has no blocking a11y violations", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await applyBackendMocks(page, { overrides: [...a11yBackendOverrides] });
    await page.goto(
      "/feature/PATRIC.1282460.2049.JX869059.CDS.1.100.fwd?tab=compare-region",
    );
    await awaitSettled(page);
    const compare = new CompareRegionPage(page);
    await compare.expectFigure(10);
    await forEachTheme(page, async (theme) => {
      const violations = await scanPage(page);
      assertNoBlockingViolations(violations, "feature-compare-region", theme);
      await expectCompareRegionContrast(page, violations, theme);
    });

    await compare.glyph(0, 0).click();
    await expect(compare.openFeature).toBeVisible();
    await expect(
      compare.featureCard.getByText("AFFC01000001", { exact: true }),
    ).toBeVisible();
    await forEachTheme(page, async (theme) => {
      const violations = await scanPage(page);
      assertNoBlockingViolations(
        violations,
        "feature-compare-region/pinned",
        theme,
      );
      await expectCompareRegionContrast(page, violations, `pinned, ${theme}`);
    });

    // The figure scrolls inside its own scroller at its minimum width, so wait for the
    // panel to measure the narrower card.
    const narrowFigure =
      plotWidthFor(densitySpecs.comfortable, 320) +
      labelWidthFor(densitySpecs.comfortable, 320);
    await page.setViewportSize({ width: 320, height: 568 });
    await expect(compare.figure).toHaveAttribute("width", String(narrowFigure));
    expect(
      await hasHorizontalScroll(page),
      "feature-compare-region: horizontal scroll at 320px viewport — WCAG 1.4.10 reflow failure",
    ).toBe(false);
  });
});
