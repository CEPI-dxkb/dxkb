import { test, expect, applyBackendMocks } from "../../mocks/backends";
import {
  authSessionOverrides,
  workspaceOverrides,
  jobsOverrides,
  a11yBackendOverrides,
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
import { scanTargets } from "../../a11y/routes";
import type { BaselineMap } from "../../a11y/baseline";
import type { RouteEntry } from "../../a11y/routes";
import type { JsonOverride } from "../../mocks/backends";
import auspiceDataset from "../../fixtures/overrides/organisms/phylogeny/auspice-tree-map-v2.json" with { type: "json" };

const auspiceDatasetId = "Influenza-A-Virus/H3N2/HA";

const baselineMap: BaselineMap = generatedBaseline;

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
    route: routeKey,
    theme,
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

function buildOverrides(route: RouteEntry): JsonOverride[] {
  if (route.unauthenticated) {
    return [...a11yBackendOverrides];
  }
  return [
    ...authSessionOverrides,
    ...(route.needsWorkspace ? workspaceOverrides : []),
    ...(route.needsJobs ? jobsOverrides : []),
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
      // Generic readiness (load state, fonts, skeleton detach) is awaitSettled's
      // job; the target's composed prepare hook adds only page-specific waits.
      await awaitSettled(page, target.route.settle);
      await target.prepare?.(page);

      // Dual-theme axe scan (light → dark).
      await forEachTheme(page, async (theme) => {
        const violations = await scanPage(page);
        assertNoBlockingViolations(violations, target.name, theme);
      });

      // WCAG 1.4.10 reflow: no horizontal scroll at 320px viewport width.
      await page.setViewportSize({ width: 320, height: 568 });
      const hasHorizontalScroll = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      if (isReflowSkipped(reflowSkip, target.name)) {
        if (hasHorizontalScroll) {
          const ticket = reflowSkip[target.name]?.ticket ?? "unknown";
          console.warn(
            `[a11y/reflow-skip] ${target.name}: horizontal scroll suppressed (${ticket})`,
          );
        }
      } else {
        expect(
          hasHorizontalScroll,
          `${target.name}: horizontal scroll at 320px viewport — WCAG 1.4.10 reflow failure`,
        ).toBe(false);
      }
    });
  }
});

test.describe("a11y component surfaces", () => {
  // Taxonomy metadata-distributions: component-scoped regression guard.
  // Full-page taxonomy scan runs in the broad sweep above.
  test("taxonomy metadata-distributions has no regression in fixed WCAG rules", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await applyBackendMocks(page, {
      overrides: [...workspaceOverrides, ...a11yBackendOverrides],
    });
    await page.goto("/taxonomy/234");

    // The section's <h2> renders synchronously; chart cards stream in after.
    await page
      .getByRole("heading", { level: 2, name: /Metadata Distributions/ })
      .waitFor({ timeout: 10_000 });
    await page.waitForLoadState("networkidle");

    const violations = await scanPage(page, {
      include: '[data-testid="metadata-distributions"]',
    });

    // Regression guard: lock four WCAG rules fixed in DXKBCORE-133.
    const lockedRules = new Set([
      "label-content-name-mismatch", // WCAG 2.5.3 — ChartLegendPill accessible name
      "aria-toggle-field-name", // WCAG 4.1.2 — aria-pressed legend toggles
      "non-text-contrast", // WCAG 1.4.11 — swatch 3:1-contrast border
      "heading-order", // WCAG 1.3.1 — chart card titles promoted to h3
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

    // Standard gate for any other violations in the scoped region.
    assertNoBlockingViolations(
      violations,
      "taxonomy-metadata-distributions",
      "dxkb-light",
    );
  });

  // Command palette interaction state — migrated to deep-tier.spec.ts in Phase 3.
  // Kept here during Phase 2 transition so coverage doesn't regress.
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
    // WebKit on Linux CI intercepts Ctrl+K via its built-in Emacs-style "delete to
    // end of line" shortcut before the keydown reaches the page. Retry with Meta+K
    // (the app listens for event.metaKey || event.ctrlKey) as a fallback.
    try {
      await commandPaletteDialog.waitFor({ state: "visible", timeout: 3_000 });
    } catch {
      await page.keyboard.press("Meta+K");
      await commandPaletteDialog.waitFor({ state: "visible", timeout: 10_000 });
    }
    // The cmdk popover renders into a portal; on WebKit the theme CSS variables
    // can momentarily lag behind the dialog's visibility, causing false-positive
    // color-contrast violations. Waiting for input auto-focus confirms full mount.
    await expect(page.locator('[data-slot="command-input"]')).toBeFocused({
      timeout: 5_000,
    });

    const violations = await scanPage(page);
    assertNoBlockingViolations(violations, "command-palette", "dxkb-light");
  });

  // Auspice phylogeny viewer — the themed iframe.
  //
  // Lives here rather than in the routes[] sweep because the viewer needs
  // charon + map-tile mocks that buildOverrides() cannot express, and because
  // the tree only mounts after two clicks. Axe traverses same-origin iframes,
  // so this scans the Auspice DOM itself; upstream Auspice violations that are
  // not ours to fix land in the baseline like any other.
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
    // Basemap tiles are the one outbound host the viewer needs; serve a 1×1 PNG.
    await page.route(
      /https:\/\/[a-d]\.basemaps\.cartocdn\.com\/.+\.png/,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "image/png",
          body: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X2NDNwAAAABJRU5ErkJggg==",
            "base64",
          ),
        }),
    );

    await page.goto("/taxonomy/2955291?tab=phylogeny");
    await page
      .getByRole("heading", { name: "Available phylogenetic trees" })
      .waitFor();

    // The picker/results pane itself has no other scan coverage — only the
    // opened viewer below is scanned. Cover both themes before navigating away.
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
    await viewer.locator("#map").waitFor();
    await viewer.getByText(/Powered by Nextstrain/).waitFor();

    // The bridge mirrors the host theme into the iframe, so scanning per theme
    // exercises both token sets inside Auspice too. color-contrast stays
    // enforced — it is the rule the theming work is accountable for.
    const auspiceFrameSelector = 'iframe[title*="Auspice"]';
    await forEachTheme(page, async (theme) => {
      // DXKB-owned host chrome (back button, tab bar, etc.) around the iframe —
      // scanned with the full ruleset, no disables.
      const hostViolations = await scanPage(page, {
        exclude: [auspiceFrameSelector],
      });
      assertNoBlockingViolations(hostViolations, "auspice-viewer-host", theme);

      // The Auspice iframe itself. Two rules are disabled here, scoped to just
      // this subtree, for pre-existing defects in the unforked Auspice bundle —
      // not introduced by DXKB and not fixable without patching the dependency.
      // Both are critical-impact, which the baseline mechanism refuses by
      // design (see canBaseline in e2e/a11y/baseline.ts), so they are disabled
      // here with their upstream cause named rather than silently suppressed.
      const iframeViolations = await scanPage(page, {
        include: auspiceFrameSelector,
        disableRules: [
          // react-select renders a hidden `dummyInput` with role=combobox and no
          // accessible name (7 nodes, one per sidebar dropdown).
          "label",
          // Auspice's own "zoom to selected" / "zoom to root" toolbar buttons
          // inside #PhylogenyCard ship without discernible text.
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
});
