import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const repoRoot = resolve(__dirname, "..", "..");

/** Directories allowed to import `src/lib/e2e-fixtures/*`; keep identical to the `no-restricted-imports` ignores in eslint.config.mjs (checked below). */
const allowedImporterDirectories = [
  "src/lib/e2e-fixtures",
  "src/app/api/e2e-mock",
  "e2e/fixtures/overrides",
] as const;

const scannedRoots = ["src", "e2e"] as const;
const scannedExtensions = [".ts", ".tsx", ".mts"] as const;

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
    // An allowlist entry with no importer left is a hole in the boundary.
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
