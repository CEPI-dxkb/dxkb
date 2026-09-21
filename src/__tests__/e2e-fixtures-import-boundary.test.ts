import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const repoRoot = resolve(__dirname, "..", "..");

/**
 * The complete set of directories allowed to import `src/lib/e2e-fixtures/*`.
 *
 * That module holds deterministic Playwright fixture DATA. It lives under
 * `src/` so the loopback mock route handler and the Vitest parity tests can
 * import it, but a client component importing it would ship fake genomes to
 * the browser. `server-only` is deliberately NOT the guard here: Playwright's
 * own Node process imports `e2e/fixtures/overrides/*`, which re-export these
 * records, and `server-only` would break that import chain.
 *
 * Keep this list identical to the `ignores` list on the `no-restricted-imports`
 * block in `eslint.config.mjs` — the last test below checks that, so ESLint
 * silently ceasing to match cannot go unnoticed.
 */
const allowedImporterDirectories = [
  "src/lib/e2e-fixtures",
  "src/app/api/e2e-mock",
  "e2e/fixtures/overrides",
] as const;

const scannedRoots = ["src", "e2e"] as const;
const scannedExtensions = [".ts", ".tsx", ".mts"] as const;

/** Any import specifier that resolves into the fixture module, alias or relative. */
const fixtureImportPattern =
  /from\s+["'](?:@\/lib\/e2e-fixtures(?:\/[^"']*)?|(?:\.\.?\/)+(?:[^"']*\/)?lib\/e2e-fixtures(?:\/[^"']*)?)["']/;

function* walkFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      yield* walkFiles(full);
    } else if (scannedExtensions.some((ext) => entry.name.endsWith(ext))) {
      yield full;
    }
  }
}

function importersOfFixtureModule(): string[] {
  const importers: string[] = [];
  for (const root of scannedRoots) {
    for (const file of walkFiles(join(repoRoot, root))) {
      if (!fixtureImportPattern.test(readFileSync(file, "utf8"))) continue;
      importers.push(relative(repoRoot, file).split(sep).join("/"));
    }
  }
  return importers.sort();
}

function owningDirectory(importer: string): string | undefined {
  return allowedImporterDirectories.find((dir) =>
    importer.startsWith(`${dir}/`),
  );
}

describe("src/lib/e2e-fixtures import boundary", () => {
  const importers = importersOfFixtureModule();

  it("is imported only from allowlisted directories", () => {
    const offenders = importers.filter(
      (importer) => owningDirectory(importer) === undefined,
    );
    expect(offenders).toEqual([]);
  });

  it("has at least one importer in every allowlisted consumer directory", () => {
    // The other direction: an allowlist entry with no importer left behind is
    // a hole in the boundary that nothing would notice closing. The fixture
    // module's own directory is excluded because its files reach each other
    // through sibling-relative specifiers (`./records`), which is not what
    // this boundary is about.
    const consumerDirectories = allowedImporterDirectories.filter(
      (dir) => dir !== "src/lib/e2e-fixtures",
    );
    const unused = consumerDirectories.filter(
      (dir) => !importers.some((importer) => importer.startsWith(`${dir}/`)),
    );
    expect(unused).toEqual([]);
  });

  it("matches the ESLint no-restricted-imports allowlist exactly", () => {
    const config = readFileSync(join(repoRoot, "eslint.config.mjs"), "utf8");
    const ruleIndex = config.indexOf('"no-restricted-imports"');
    expect(ruleIndex).toBeGreaterThan(-1);

    const ignoresStart = config.lastIndexOf("ignores: [", ruleIndex);
    expect(ignoresStart).toBeGreaterThan(-1);
    const openBracket = config.indexOf("[", ignoresStart);
    const closeBracket = config.indexOf("]", openBracket);
    const block = config.slice(openBracket, closeBracket);
    const declared = [...block.matchAll(/"([^"]+)\/\*\*"/g)].map((m) => m[1]);

    expect(declared).toEqual([...allowedImporterDirectories]);
  });
});
