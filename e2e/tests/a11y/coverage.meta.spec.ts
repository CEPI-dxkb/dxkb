import { test, expect } from "@playwright/test";
import { glob, readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildScanTargets,
  composePrepare,
  coveredPageFiles,
  routes,
  scanTargets,
} from "../../a11y/routes";
import type { PrepareHook, RouteEntry } from "../../a11y/routes";
import {
  baselineWildcardKey,
  extractScannedKeys,
  findStaleScanKeys,
  formatStaleScanKeys,
  nonRouteScanKeys,
} from "../../a11y/scan-keys";
import generatedBaseline, { reflowSkip } from "../../a11y/baseline.generated";

const appDir = path.resolve(process.cwd(), "src/app");

async function readPageFiles(): Promise<string[]> {
  const pageFiles: string[] = [];
  for await (const file of glob("**/page.tsx", { cwd: appDir })) {
    pageFiles.push(file.replaceAll("\\", "/"));
  }
  return pageFiles;
}

test.describe("a11y coverage accounting", () => {
  test("every src/app page.tsx is scanned, aliased, or redirectOnly", async () => {
    const pageFiles = await readPageFiles();

    expect(
      pageFiles.length,
      "expected to find page.tsx files in src/app",
    ).toBeGreaterThan(0);

    const uncovered = pageFiles.filter((f) => !coveredPageFiles.has(f));

    expect(
      uncovered,
      uncovered.length === 0
        ? undefined
        : `${String(uncovered.length)} page.tsx file(s) not accounted for in routes.ts.\n` +
            `Add each one to the "pages" array of the routes[] entry that scans it in\n` +
            `e2e/a11y/routes.ts — add a new entry if no existing scan reaches the page,\n` +
            `or a redirectOnly entry if the route only ever redirects:\n` +
            uncovered.map((f) => `  - src/app/${f}`).join("\n"),
    ).toEqual([]);
  });

  test("no route entry claims a page.tsx that is absent from src/app", async () => {
    const pageFiles = new Set(await readPageFiles());

    const phantoms = routes.flatMap((route) =>
      route.pages
        .filter((file) => !pageFiles.has(file))
        .map((file) => ({ route: route.name, file })),
    );

    expect(
      phantoms,
      phantoms.length === 0
        ? undefined
        : `${String(phantoms.length)} declared page.tsx file(s) no longer exist in src/app.\n` +
            `Remove them from the owning entry's "pages" array in e2e/a11y/routes.ts:\n` +
            phantoms
              .map(
                ({ route, file }) =>
                  `  - ${file} (declared by route "${route}")`,
              )
              .join("\n"),
    ).toEqual([]);
  });

  test("every non-redirect scan target maps to at least one source page file", () => {
    const unmapped = scanTargets
      .filter((target) => target.route.pages.length === 0)
      .map((target) => target.name);

    expect(
      unmapped,
      unmapped.length === 0
        ? undefined
        : `${String(unmapped.length)} scanned route(s) declare no source page file.\n` +
            `Populate "pages" on the owning entry in e2e/a11y/routes.ts:\n` +
            unmapped.map((name) => `  - ${name}`).join("\n"),
    ).toEqual([]);

    const unaccountedRedirects = routes
      .filter((route) => route.redirectOnly && route.pages.length === 0)
      .map((route) => route.name);
    expect(
      unaccountedRedirects,
      `redirectOnly entries must still declare the page.tsx they account for`,
    ).toEqual([]);
  });

  test("no page.tsx is claimed by more than one route entry", () => {
    const owners = new Map<string, string[]>();
    for (const route of routes) {
      for (const file of route.pages) {
        owners.set(file, [...(owners.get(file) ?? []), route.name]);
      }
    }

    const duplicates = [...owners.entries()].filter(
      ([, routeNames]) => routeNames.length > 1,
    );

    expect(
      duplicates,
      duplicates.length === 0
        ? undefined
        : `${String(duplicates.length)} page.tsx file(s) are claimed by multiple route entries.\n` +
            `Coverage is a union, so a duplicate hides an accounting mistake rather than\n` +
            `failing. Leave the file on exactly one entry in e2e/a11y/routes.ts:\n` +
            duplicates
              .map(
                ([file, routeNames]) => `  - ${file}: ${routeNames.join(", ")}`,
              )
              .join("\n"),
    ).toEqual([]);
  });
});

// Pure derivation logic, so no browser fixture: this file has its own config
// (playwright.a11y.meta.config.ts).
test.describe("a11y scan target derivation", () => {
  test("a composed hook runs the parent first, then the variant", async () => {
    const calls: string[] = [];
    const record = (label: string) => (target: string) => {
      calls.push(`${label}:${target}`);
      return Promise.resolve();
    };
    const parent = record("parent");
    const variant = record("variant");

    await composePrepare(parent, variant)?.("page");
    expect(calls).toEqual(["parent:page", "variant:page"]);

    expect(composePrepare(parent, undefined)).toBe(parent);
    expect(composePrepare(undefined, variant)).toBe(variant);
    expect(composePrepare(undefined, undefined)).toBeUndefined();
  });

  test("variant targets keep the parent prepare hook instead of replacing it", () => {
    const parentHook: PrepareHook = () => Promise.resolve();
    const variantHook: PrepareHook = () => Promise.resolve();

    const fixture: RouteEntry[] = [
      {
        name: "parent",
        path: "/",
        pages: ["page.tsx"],
        prepare: parentHook,
        variants: [
          { nameSuffix: "own-hook", path: "/?a", prepare: variantHook },
          { nameSuffix: "no-hook", path: "/?b" },
        ],
      },
      {
        name: "redirect",
        path: "/redirect",
        pages: ["page.tsx"],
        redirectOnly: true,
      },
    ];

    const targets = buildScanTargets(fixture);

    expect(targets.map((t) => t.name)).toEqual([
      "parent/own-hook",
      "parent/no-hook",
    ]);
    expect(targets.map((t) => t.path)).toEqual(["/?a", "/?b"]);

    // A composed hook is neither function's identity (`variant.prepare ??
    // route.prepare` dropped the parent's).
    expect(targets[0]?.prepare).not.toBe(variantHook);
    expect(targets[0]?.prepare).not.toBe(parentHook);
    expect(targets[0]?.prepare).toBeDefined();

    expect(targets[1]?.prepare).toBe(parentHook);
  });

  test("scan targets cover every non-redirect route entry exactly once", () => {
    const scannedRouteNames = new Set(
      scanTargets.map((target) => target.route.name),
    );
    const expected = routes
      .filter((route) => !route.redirectOnly)
      .map((route) => route.name);

    expect([...scannedRouteNames].sort()).toEqual([...expected].sort());
  });
});

test.describe("a11y suppression keys", () => {
  test("every baseline route key matches a current scan target", () => {
    const stale = findStaleScanKeys(Object.keys(generatedBaseline), {
      allowWildcard: true,
    });

    expect(
      stale,
      stale.length === 0
        ? undefined
        : formatStaleScanKeys("baseline.generated.ts", stale),
    ).toEqual([]);
  });

  test("every reflowSkip key matches a current scan target", () => {
    const stale = findStaleScanKeys(Object.keys(reflowSkip), {
      allowWildcard: false,
    });

    expect(
      stale,
      stale.length === 0 ? undefined : formatStaleScanKeys("reflowSkip", stale),
    ).toEqual([]);
  });

  test("every enumerated non-route scan key is still scanned by a spec", async () => {
    const specDir = path.resolve(process.cwd(), "e2e/tests/a11y");
    const scanned = new Set<string>();
    let sourceCount = 0;
    for await (const file of glob("*.spec.ts", { cwd: specDir })) {
      // Skip this spec: its extractor fixtures are string literals, not scans. Keyed
      // off `__filename` because Playwright loads specs as CJS, where `import.meta` is
      // a syntax error.
      if (file === path.basename(__filename)) continue;
      sourceCount++;
      const source = await readFile(path.join(specDir, file), "utf8");
      for (const key of extractScannedKeys(source)) scanned.add(key);
    }
    expect(sourceCount, "expected a11y spec sources to read").toBeGreaterThan(
      0,
    );
    expect(
      scanned.size,
      "expected to extract scan keys from the a11y spec sources",
    ).toBeGreaterThan(0);

    const unreferenced = nonRouteScanKeys.filter((key) => !scanned.has(key));

    expect(
      unreferenced,
      unreferenced.length === 0
        ? undefined
        : `${String(unreferenced.length)} key(s) in nonRouteScanKeys are not passed to any\n` +
            `assertNoBlocking* call in e2e/tests/a11y/*.spec.ts. Remove them from\n` +
            `nonRouteScanKeys in e2e/a11y/scan-keys.ts (and drop any suppression\n` +
            `keyed by them), or fix the call that should be using them:\n` +
            unreferenced.map((key) => `  - ${key}`).join("\n"),
    ).toEqual([]);
  });

  test("only a top-level literal in a live call counts as scanned", () => {
    const source = [
      '// legacy surface: "ghost-surface" was scanned here until DXKBCORE-000',
      '// assertNoBlocking(page, "commented-out-surface", theme);',
      'assertNoBlockingViolations(violations, /* was "ghost-in-args" */ target.name, theme);',
      'assertNoBlockingViolations(scanPage(page, "nested-surface"), target.name, theme);',
      'assertNoBlocking(page, { include: "object-surface" }, theme);',
      'assertNoBlocking("wrong-position", target.name, theme);',
      'assertNoBlockingViolations(violations, "real//surface", theme);',
      'assertNoBlockingViolations(violations, "real-surface", theme);',
      'helper.assertNoBlocking(page, "member-surface", theme);',
      'assertNoBlockingUnexpected(page, "unsupported-surface", theme);',
      "assertNoBlockingViolations(violations, target.name, theme);",
      'assertNoBlocking(\n  page,\n  "multiline-surface",\n  theme,\n);',
    ].join("\n");

    expect(extractScannedKeys(source)).toEqual([
      "real//surface",
      "real-surface",
      "multiline-surface",
    ]);
  });

  test("only direct string literal arguments are accepted", () => {
    const source = [
      "assertNoBlocking(page, `template-surface`, theme);",
      "assertNoBlocking(page, 'single-quoted-surface', theme);",
      "assertNoBlocking(page, surfaceNameVariable, theme);",
      'assertNoBlocking(page, "pre" + "fix", theme);',
    ].join("\n");

    expect(extractScannedKeys(source)).toEqual(["single-quoted-surface"]);
  });
});

test.describe("stale scan key detection", () => {
  test("only keys naming no scan target are reported, and every one is named", () => {
    const realRouteKey = scanTargets[0]?.name ?? "";
    expect(realRouteKey, "expected at least one scan target").not.toEqual("");

    const stale = findStaleScanKeys(
      [
        realRouteKey,
        nonRouteScanKeys[0],
        baselineWildcardKey,
        "organisms-virusez",
        "no-such-scan-target",
      ],
      { allowWildcard: true },
    );
    expect(stale).toEqual(["organisms-virusez", "no-such-scan-target"]);

    const message = formatStaleScanKeys("baseline.generated.ts", stale);
    for (const key of stale) expect(message).toContain(key);
    expect(message).toContain("baseline.generated.ts");

    expect(
      findStaleScanKeys([baselineWildcardKey], { allowWildcard: false }),
    ).toEqual([baselineWildcardKey]);

    expect(
      findStaleScanKeys([...nonRouteScanKeys], { allowWildcard: false }),
    ).toEqual([]);
  });
});
