import { relative, resolve } from "node:path";

const srcDir = resolve(__dirname, "..");

// Every static `import`/`export … from` statement, multi-line ones included,
// with its clause (empty for a side-effect import) and its module specifier.
const staticImport =
  /^\s*(?:import|export)\s+([^;"']*?)\s*(?:from\s+)?["']([^"']+)["']/gm;

/** A specifier as its `@/` path, so a relative import is caught like an alias one. */
export function aliasPath(specifier: string, fromDir: string): string {
  if (!specifier.startsWith(".")) return specifier;
  return `@/${relative(srcDir, resolve(fromDir, specifier)).split("\\").join("/")}`;
}

/**
 * Specifiers of the value imports (not `import type`) in `source`, which lives
 * in `fromDir`, whose `@/` path matches `target`. Returned as written.
 */
export function valueImportsMatching(
  source: string,
  fromDir: string,
  target: RegExp,
): string[] {
  return [...source.matchAll(staticImport)]
    .filter(([, clause, specifier]) => {
      if (!target.test(aliasPath(specifier, fromDir))) return false;
      return !/^type\s/.test(clause);
    })
    .map(([, , specifier]) => specifier);
}
