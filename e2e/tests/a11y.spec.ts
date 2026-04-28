import AxeBuilder from "@axe-core/playwright";

import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  authSessionOverrides,
  workspaceOverrides,
  jobsOverrides,
  permissiveBackendOverrides,
} from "../fixtures/overrides";

// Axe tags we want enforced. WCAG 2.1 AA is the practical bar for the suite.
const axeTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// Rules with persistent failures across the suite that pre-date axe enforcement.
// Disable explicitly (rather than blanket-ignoring whole impact levels) so any
// new failure modes surface immediately. Tighten this list as the underlying
// issues are fixed.
//
// - button-name: navbar SearchBar's <select> trigger and its inner base-ui
//   button render without an accessible name. Same component appears on every
//   non-home page, so it shows up everywhere. Fix is a one-line aria-label on
//   the SelectTrigger in src/components/search/search-bar.tsx.
// - color-contrast: home statistics tiles, sign-in footer links, and the
//   genome-assembly help anchors fall below 4.5:1. Theme-token work, not a
//   spec change.
// - aria-required-children: WorkspaceDataTable's TanStack virtual scroller
//   uses role="grid" on a wrapper whose direct children are role="presentation"
//   rows — axe wants role="row". This is a TanStack Table v8 limitation
//   (issue tracked upstream).
const knownBaselineViolations = ["button-name", "color-contrast", "aria-required-children"];

interface AxeRoute {
  name: string;
  path: string;
  unauthenticated?: boolean;
  /** Optional setup hook — wait for a specific element/state before running axe. */
  prepare?: (page: import("@playwright/test").Page) => Promise<void>;
}

const routes: AxeRoute[] = [
  {
    name: "home",
    path: "/",
    unauthenticated: true,
  },
  {
    name: "sign-in",
    path: "/sign-in",
    unauthenticated: true,
  },
  {
    name: "workspace",
    path: "/workspace",
    prepare: async (page) => {
      await page.waitForURL(/\/workspace\/[^/]+\/home/, { timeout: 10_000 });
      await page.getByPlaceholder(/search files/i).waitFor({ timeout: 10_000 });
    },
  },
  {
    name: "genome-assembly form",
    path: "/services/genome-assembly",
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
  {
    name: "jobs",
    path: "/jobs",
    prepare: async (page) => {
      await page.waitForLoadState("networkidle");
    },
  },
];

test.describe("a11y axe sweep", () => {
  for (const route of routes) {
    test(`${route.name} (${route.path}) has no serious or critical violations`, async ({
      page,
      context,
    }) => {
      if (route.unauthenticated) {
        await context.clearCookies();
      }

      const overrides = route.unauthenticated
        ? [
            {
              url: "/api/auth/get-session",
              method: "GET",
              status: 200,
              body: { user: null, session: null },
            } as const,
            ...permissiveBackendOverrides,
          ]
        : [
            ...authSessionOverrides,
            ...workspaceOverrides,
            ...jobsOverrides,
            ...permissiveBackendOverrides,
          ];

      await applyBackendMocks(page, { overrides });
      await page.goto(route.path);
      await route.prepare?.(page);

      const builder = new AxeBuilder({ page })
        .withTags(axeTags)
        .disableRules(knownBaselineViolations);
      const results = await builder.analyze();

      const blocking = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      const advisory = results.violations.filter(
        (v) => v.impact !== "serious" && v.impact !== "critical",
      );

      if (advisory.length > 0) {
        const summary = advisory
          .map((v) => `  - [${v.impact ?? "minor"}] ${v.id}: ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"})`)
          .join("\n");
        console.warn(
          `[a11y] ${route.name}: ${advisory.length} non-blocking violation(s):\n${summary}`,
        );
      }

      const blockingSummary = blocking
        .map((v) => {
          const targets = v.nodes
            .slice(0, 3)
            .map((n) => `      ${n.target.join(" ")}`)
            .join("\n");
          return `  - [${v.impact}] ${v.id}: ${v.help}\n${targets}`;
        })
        .join("\n");
      expect(
        blocking,
        blocking.length === 0
          ? undefined
          : `${blocking.length} blocking a11y violation(s) on ${route.name}:\n${blockingSummary}`,
      ).toEqual([]);
    });
  }
});
