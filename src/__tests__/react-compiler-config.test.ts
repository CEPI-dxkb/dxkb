import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..");

const optOutFiles = [
  "src/components/shared/data-table.tsx",
  // Extracted out of data-table.tsx's useDataTableContent, which is itself
  // opted out. Each child keys derived values off `table` identity, which is
  // only unstable because useTable receives a fresh options literal.
  "src/components/shared/data-table-header.tsx",
  "src/components/shared/data-table-controls.tsx",
  "src/components/shared/data-table-footer.tsx",
  "src/components/workspace/file-viewer/viewers/csv-viewer.tsx",
  "src/components/organisms/reference-genomes/reference-genomes-client.tsx",
  "src/components/taxonomy/taxonomy-tree.tsx",
] as const;

function readRepoFile(relPath: string): string {
  return readFileSync(join(repoRoot, relPath), "utf8");
}

function* walkFiles(dir: string, extensions: readonly string[]): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name.startsWith("__"))
        continue;
      yield* walkFiles(full, extensions);
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      yield full;
    }
  }
}

describe("React Compiler configuration", () => {
  it("next.config.ts has reactCompiler: true", () => {
    const config = readRepoFile("next.config.ts");
    expect(config).toMatch(/reactCompiler:\s*true/);
  });

  it("package.json declares babel-plugin-react-compiler ^1.x in devDependencies", () => {
    const pkg = JSON.parse(readRepoFile("package.json")) as {
      devDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
    };
    expect(pkg.devDependencies?.["babel-plugin-react-compiler"]).toMatch(/^\^?1\./);
    expect(pkg.dependencies?.["babel-plugin-react-compiler"]).toBeUndefined();
  });

  it.each(optOutFiles)('"%s" still contains the "use no memo" directive', (path) => {
    expect(readRepoFile(path)).toContain('"use no memo"');
  });

  it("eslint.config.mjs opt-out files list matches the documented opt-out set exactly", () => {
    const eslintConfig = readRepoFile("eslint.config.mjs");
    for (const optOut of optOutFiles) {
      expect(eslintConfig).toContain(`"${optOut}"`);
    }

    const blockMatch = /"react-hooks\/incompatible-library":\s*"off"/.exec(eslintConfig);
    expect(blockMatch).not.toBeNull();
    const arrayStart = eslintConfig.lastIndexOf("files: [", blockMatch?.index);
    const openBracket = eslintConfig.indexOf("[", arrayStart);
    // Walk forward tracking bracket depth so paths containing "]" (e.g. Next.js
    // dynamic-route segments like "[id]") don't truncate the captured block.
    let depth = 0;
    let arrayEnd = -1;
    for (let i = openBracket; i < eslintConfig.length; i++) {
      const ch = eslintConfig[i];
      if (ch === "[") depth++;
      else if (ch === "]") {
        depth--;
        if (depth === 0) {
          arrayEnd = i;
          break;
        }
      }
    }
    expect(arrayEnd).toBeGreaterThan(openBracket);
    const block = eslintConfig.slice(openBracket, arrayEnd);
    const declaredPaths = [...block.matchAll(/"([^"]+\.tsx?)"/g)].map((m) => m[1]);
    expect(declaredPaths).toEqual([...optOutFiles]);
  });

  it("no src file uses \"use no memo\" without being in the eslint config opt-out list", () => {
    const offenders: string[] = [];
    for (const file of walkFiles(join(repoRoot, "src"), [".tsx", ".ts"])) {
      if (!readFileSync(file, "utf8").includes('"use no memo"')) continue;
      const relPath = relative(repoRoot, file);
      if (!(optOutFiles as readonly string[]).includes(relPath)) {
        offenders.push(relPath);
      }
    }
    expect(offenders).toEqual([]);
  });

  it.skipIf(!existsSync(join(repoRoot, ".next", "static", "chunks")))(
    "compiled bundles contain the React Compiler memo-cache sentinel",
    () => {
      const chunksDir = join(repoRoot, ".next", "static", "chunks");
      const sentinel = 'Symbol.for("react.memo_cache_sentinel")';
      for (const file of walkFiles(chunksDir, [".js"])) {
        if (readFileSync(file, "utf8").includes(sentinel)) return;
      }
      throw new Error(
        `Did not find ${sentinel} in any chunk under ${chunksDir}. ` +
          "Either the React Compiler is not running, or the build is stale.",
      );
    },
  );
});
