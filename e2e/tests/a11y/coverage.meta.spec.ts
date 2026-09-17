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

// Resolve the src/app directory relative to the repo root.
const appDir = path.resolve(process.cwd(), "src/app");

/** Glob every page.tsx under src/app, normalized to posix paths relative to it. */
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
    // Invert check: every declared page file must exist on disk.
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

    // redirectOnly entries are never scanned but must still carry accounting.
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

// These assert pure derivation logic, so they take no browser fixture. That is
// also why this whole file has its own config (playwright.a11y.meta.config.ts):
// it launches no browser and needs no web server, so it must not share the
// sweep's outputDir or JSON report path.
test.describe("a11y scan target derivation", () => {
  test("a composed hook runs the parent first, then the variant", async () => {
    const calls: string[] = [];
    const record = (label: string) => (target: string) => {
      calls.push(`${label}:${target}`);
      return Promise.resolve();
    };
    const parent = record("parent");
    const variant = record("variant");

    // Both present: parent first, variant second, same argument forwarded to each.
    await composePrepare(parent, variant)?.("page");
    expect(calls).toEqual(["parent:page", "variant:page"]);

    // One side absent: the other is returned untouched, not wrapped.
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

    // redirectOnly is dropped; each variant becomes its own target, keyed for baseline.
    expect(targets.map((t) => t.name)).toEqual([
      "parent/own-hook",
      "parent/no-hook",
    ]);
    expect(targets.map((t) => t.path)).toEqual(["/?a", "/?b"]);

    // The regression this guards: `variant.prepare ?? route.prepare` handed back
    // the variant's own function and silently dropped the parent's. A composed
    // hook is neither function's identity.
    expect(targets[0]?.prepare).not.toBe(variantHook);
    expect(targets[0]?.prepare).not.toBe(parentHook);
    expect(targets[0]?.prepare).toBeDefined();

    // A variant without its own hook still inherits the parent's, unwrapped.
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
    // Keeps the sanctioned enumeration from outliving the scans it names: a
    // surface that is deleted or renamed leaves its key here unreferenced.
    // Matched against the `assertNoBlocking*` argument rather than the raw
    // source, so a key that survives only in a comment does not count.
    const specDir = path.resolve(process.cwd(), "e2e/tests/a11y");
    const scanned = new Set<string>();
    let sourceCount = 0;
    for await (const file of glob("*.spec.ts", { cwd: specDir })) {
      // Skip this spec. It scans nothing — it contains no live
      // `assertNoBlocking*` call, only extractor *fixtures* like
      // "real-surface" and "multiline-surface" as string literals. Harvesting
      // them would put strings into `scanned` that no spec ever scanned, which
      // is exactly what would let a stale `nonRouteScanKeys` entry survive the
      // check below. Filtered here rather than through `glob`'s `exclude` so
      // the reason travels with the code and the guard does not depend on that
      // option's semantics.
      if (file === "coverage.meta.spec.ts") continue;
      sourceCount++;
      const source = await readFile(path.join(specDir, file), "utf8");
      for (const key of extractScannedKeys(source)) scanned.add(key);
    }
    expect(sourceCount, "expected a11y spec sources to read").toBeGreaterThan(0);
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
    // Every line here miscredited a key at some point in this task's history.
    const source = [
      // 1. A key surviving only in a comment (the original `includes()` bug).
      '// legacy surface: "ghost-surface" was scanned here until DXKBCORE-000',
      // 2. A fully commented-out call.
      '// assertNoBlocking(page, "commented-out-surface", theme);',
      // 3. A block comment inside a live call's argument list.
      'assertNoBlockingViolations(violations, /* was "ghost-in-args" */ target.name, theme);',
      // 4. A nested call's literal, and an object literal's.
      'assertNoBlockingViolations(scanPage(page, "nested-surface"), target.name, theme);',
      'assertNoBlocking(page, { include: "object-surface" }, theme);',
      // 5. A `//` inside a string must not start a comment.
      'assertNoBlockingViolations(violations, "real//surface", theme);',
      // What should be picked up:
      'assertNoBlockingViolations(violations, "real-surface", theme);',
      "assertNoBlockingViolations(violations, target.name, theme);",
      'assertNoBlocking(\n  page,\n  "multiline-surface",\n  theme,\n);',
    ].join("\n");

    expect(extractScannedKeys(source)).toEqual([
      "real//surface",
      "real-surface",
      "multiline-surface",
    ]);
  });

  test("a key passed as anything but a plain double-quoted literal is rejected", () => {
    // These fail *closed* — the key is reported unreferenced rather than
    // credited. Pinned so the doc comment's list stays true.
    const source = [
      "assertNoBlocking(page, `template-surface`, theme);",
      "assertNoBlocking(page, 'single-quoted-surface', theme);",
      "assertNoBlocking(page, surfaceNameVariable, theme);",
      'assertNoBlocking(page, "pre" + "fix", theme);',
    ].join("\n");

    // The concatenation contributes its first fragment, not the joined key —
    // which is still a rejection of "prefix", the key someone meant.
    expect(extractScannedKeys(source)).toEqual(["pre"]);
  });
});

test.describe("stale scan key detection", () => {
  test("only keys naming no scan target are reported, and every one is named", () => {
    const realRouteKey = scanTargets[0]?.name ?? "";
    expect(realRouteKey, "expected at least one scan target").not.toEqual("");

    // Both stale keys are synthetic. An earlier version used "experiment",
    // which is stale only because that route entry currently has variants —
    // giving it a plain entry again would have failed this test with a message
    // about stale-key detection instead of about the route change. The
    // experiment decision is pinned by reflowSkip's own comment.
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

    // The message has to name every rejected key — a guard that says "stale
    // key" without saying which one costs more time than it saves.
    const message = formatStaleScanKeys("baseline.generated.ts", stale);
    for (const key of stale) expect(message).toContain(key);
    expect(message).toContain("baseline.generated.ts");

    // reflowSkip has no wildcard, so "*" is dead weight there rather than valid.
    expect(
      findStaleScanKeys([baselineWildcardKey], { allowWildcard: false }),
    ).toEqual([baselineWildcardKey]);

    // Every sanctioned non-route key is accepted, not just the first.
    expect(
      findStaleScanKeys([...nonRouteScanKeys], { allowWildcard: false }),
    ).toEqual([]);
  });
});
