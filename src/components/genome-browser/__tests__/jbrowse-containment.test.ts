import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const repoRoot = resolve(__dirname, "..", "..", "..", "..");

/**
 * The only files that import JBrowse. JBrowse is a pinned 5.0 beta whose APIs
 * change between builds, and several MB: kept to these four, it stays in the
 * lazily loaded browser chunk and a beta bump touches nothing else (AGENTS.md
 * "New genome browser track"). Vitest never imports them.
 */
const jbrowseImporters = [
  "src/components/genome-browser/genome-browser-view.tsx",
  "src/components/genome-browser/jbrowse/adapter-config.ts",
  "src/components/genome-browser/jbrowse/adapters.ts",
  "src/components/genome-browser/jbrowse/plugin.ts",
];

/** A static, dynamic, side-effect or `require` import of an `@jbrowse/` package. */
const jbrowseImportPattern =
  /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)["']@jbrowse\//;

/** Source files, without `__tests__` (the `view-icons.test.tsx` scan's rule). */
function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__") yield* sourceFiles(full);
    } else if (/\.(?:[cm]?[jt]sx?)$/.test(entry.name)) {
      yield full;
    }
  }
}

function importersOfJBrowse(): string[] {
  return [...sourceFiles(join(repoRoot, "src"))]
    .filter((file) => jbrowseImportPattern.test(readFileSync(file, "utf8")))
    .map((file) => relative(repoRoot, file).split(sep).join("/"))
    .sort();
}

describe("JBrowse containment", () => {
  it("is imported only by the Genome Browser's view and its jbrowse/ adapters", () => {
    expect(importersOfJBrowse()).toEqual(jbrowseImporters);
  });

  it("recognizes every import form", () => {
    for (const source of [
      'import Plugin from "@jbrowse/core/Plugin";',
      "import type { Instance } from '@jbrowse/mobx-state-tree';",
      'import "@jbrowse/core/ui/theme";',
      'const view = await import("@jbrowse/react-linear-genome-view2");',
      'export { observeSession } from "@jbrowse/product-core";',
      'require("@jbrowse/core")',
    ]) {
      expect(jbrowseImportPattern.test(source), source).toBe(true);
    }
    expect(jbrowseImportPattern.test("// `@jbrowse/core` is pinned")).toBe(
      false,
    );
  });
});
