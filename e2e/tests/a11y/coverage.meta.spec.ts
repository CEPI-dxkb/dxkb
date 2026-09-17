import { test, expect } from "@playwright/test";
import { glob } from "node:fs/promises";
import path from "node:path";
import {
  buildScanTargets,
  composePrepare,
  coveredPageFiles,
  routes,
  scanTargets,
} from "../../a11y/routes";
import type { PrepareHook, RouteEntry } from "../../a11y/routes";

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
