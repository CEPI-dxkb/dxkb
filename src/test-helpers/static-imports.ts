import { relative, resolve } from "node:path";

import ts from "typescript";

const srcDir = resolve(__dirname, "..");

export function aliasPath(specifier: string, fromDir: string): string {
  if (!specifier.startsWith(".")) return specifier;
  return `@/${relative(srcDir, resolve(fromDir, specifier)).split("\\").join("/")}`;
}

/** Value-import specifiers in `source` whose `@/` path matches `target`, via the TypeScript parser; type-only imports are skipped. */
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
