import ts from "typescript";

import { scanTargets } from "./routes";

/**
 * Scan keys that are deliberately not route-entry names: surfaces a spec
 * scans directly. `coverage.meta.spec.ts` checks each is still passed as a
 * string literal to an `assertNoBlocking*` call; template literals and
 * variables fail closed.
 */
export const nonRouteScanKeys: readonly string[] = [
  "taxonomy-metadata-distributions",
  "command-palette",
  "auspice-picker",
  "auspice-viewer-host",
  "auspice-viewer-iframe",
  "genome-browser-host",
  "genome-browser-view",
  "circular-viewer",
  "feature-browser-host",
  "feature-browser-view",
  "feature-compare-region",
  "feature-compare-region/pinned",
  "genome-assembly/validation-errors",
  "genome-assembly/file-picker-open",
  "genome-assembly/file-picker-file-info",
  "blast/folder-picker-open",
  "blast/folder-picker-new-folder",
  "blast/folder-picker-upload",
  "workspace/populated",
  "workspace/empty",
  "workspace/details-panel-open",
  "workspace/new-folder-dialog",
  "workspace/upload-dialog",
  "jobs/populated",
  "jobs/empty",
  "jobs/failed-row",
  "jobs/kill-dialog",
  "search/no-results",
  "command-palette/open",
  "settings/default",
  "settings/error-toast",
  "interactions/graph",
  "file-viewer/text",
  "file-viewer/csv",
  "file-viewer/json",
];

export function extractScannedKeys(source: string): string[] {
  const keys: string[] = [];
  const supportedCallees = new Set([
    "assertNoBlocking",
    "assertNoBlockingViolations",
  ]);
  const sourceFile = ts.createSourceFile(
    "a11y-spec.ts",
    source,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  );
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      supportedCallees.has(node.expression.text)
    ) {
      const scanKey = node.arguments[1];
      if (ts.isStringLiteral(scanKey)) keys.push(scanKey.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return keys;
}

/**
 * `reflowSkip` does not accept the wildcard (`isReflowSkipped` tests plain
 * key membership), so a `"*"` there is reported as stale.
 */
export const baselineWildcardKey = "*";

export const knownScanKeys: ReadonlySet<string> = new Set([
  ...scanTargets.map((target) => target.name),
  ...nonRouteScanKeys,
]);

export interface StaleScanKeyOptions {
  allowWildcard: boolean;
}

export function findStaleScanKeys(
  keys: readonly string[],
  { allowWildcard }: StaleScanKeyOptions,
): string[] {
  return keys.filter((key) => {
    if (allowWildcard && key === baselineWildcardKey) return false;
    return !knownScanKeys.has(key);
  });
}

export function formatStaleScanKeys(
  mapName: string,
  staleKeys: readonly string[],
): string {
  return (
    `${String(staleKeys.length)} key(s) in ${mapName} match no current a11y scan target:\n` +
    staleKeys.map((key) => `  - ${key}`).join("\n") +
    `\nA scan key is a routes.ts entry name, \`\${name}/\${variant.nameSuffix}\` for an\n` +
    `entry that has variants, or one of the non-route scans enumerated in\n` +
    `nonRouteScanKeys (e2e/a11y/scan-keys.ts). Renaming a route or giving it\n` +
    `variants silently stops its suppressions from matching, so rename the key\n` +
    `here in the same change — or delete it if the suppression is no longer needed.`
  );
}
