import { relative, resolve } from "node:path";

import ts from "typescript";

const srcDir = resolve(__dirname, "..");

/** A specifier as its `@/` path, so a relative import is caught like an alias one. */
export function aliasPath(specifier: string, fromDir: string): string {
  if (!specifier.startsWith(".")) return specifier;
  return `@/${relative(srcDir, resolve(fromDir, specifier)).split("\\").join("/")}`;
}

/**
 * Specifiers of the value imports (not type-only ones) in `source`, which lives
 * in `fromDir`, whose `@/` path matches `target`. Returned as written. Covers
 * every top-level `import` and `export … from`; the TypeScript parser, not a
 * regex, so comments and strings cannot hide or fake a specifier. A
 * declaration TypeScript drops (`import type`, or braces whose every
 * specifier is an inline `type` one) adds nothing to the runtime graph.
 */
export function valueImportsMatching(
  source: string,
  fromDir: string,
  target: RegExp,
): string[] {
  const file = ts.createSourceFile(
    "source.tsx",
    source,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TSX,
  );
  const specifiers: string[] = [];
  for (const statement of file.statements) {
    let specifier: ts.Expression | undefined;
    let typeOnly = false;
    if (ts.isImportDeclaration(statement)) {
      specifier = statement.moduleSpecifier;
      const clause = statement.importClause;
      const bindings = clause?.namedBindings;
      typeOnly =
        clause !== undefined &&
        (clause.phaseModifier === ts.SyntaxKind.TypeKeyword ||
          (clause.name === undefined &&
            bindings !== undefined &&
            ts.isNamedImports(bindings) &&
            bindings.elements.length > 0 &&
            bindings.elements.every((element) => element.isTypeOnly)));
    } else if (ts.isExportDeclaration(statement)) {
      specifier = statement.moduleSpecifier;
      const exports = statement.exportClause;
      typeOnly =
        statement.isTypeOnly ||
        (exports !== undefined &&
          ts.isNamedExports(exports) &&
          exports.elements.length > 0 &&
          exports.elements.every((element) => element.isTypeOnly));
    }
    if (specifier === undefined || !ts.isStringLiteralLike(specifier)) continue;
    if (typeOnly || !target.test(aliasPath(specifier.text, fromDir))) continue;
    specifiers.push(specifier.text);
  }
  return specifiers;
}
