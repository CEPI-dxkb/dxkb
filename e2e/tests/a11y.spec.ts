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

// All known violations fixed in DXKBCORE-133. Add IDs back here only with
// linked tickets and a target removal date.
const knownBaselineViolations: string[] = [];

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

function summarizeViolations(
  results: { violations: { id: string; impact?: string | null; help: string; nodes: { target: unknown[] }[] }[] },
  routeName: string,
) {
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
      `[a11y] ${routeName}: ${advisory.length} non-blocking violation(s):\n${summary}`,
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

  return { blocking, blockingSummary };
}

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

      const { blocking, blockingSummary } = summarizeViolations(
        results,
        route.name,
      );
      expect(
        blocking,
        blocking.length === 0
          ? undefined
          : `${blocking.length} blocking a11y violation(s) on ${route.name}:\n${blockingSummary}`,
      ).toEqual([]);
    });
  }

  test("command palette (open) has no serious or critical violations", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspaceOverrides,
        ...jobsOverrides,
        ...permissiveBackendOverrides,
      ],
    });
    await page.goto("/jobs");
    await page.waitForLoadState("networkidle");

    const modifierKey = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifierKey}+K`);
    await page.getByRole("dialog", { name: /command palette/i }).waitFor({
      state: "visible",
      timeout: 10_000,
    });

    const builder = new AxeBuilder({ page })
      .withTags(axeTags)
      .disableRules(knownBaselineViolations);
    const results = await builder.analyze();

    const { blocking, blockingSummary } = summarizeViolations(
      results,
      "command-palette",
    );
    expect(
      blocking,
      blocking.length === 0
        ? undefined
        : `${blocking.length} blocking a11y violation(s) on command palette:\n${blockingSummary}`,
    ).toEqual([]);
  });
});
