import { scanTargets } from "./routes";

/**
 * Scan keys that are deliberately NOT route-entry names.
 *
 * `baseline.generated.ts` and `reflowSkip` are keyed by scan key, and most keys
 * are route names (or `${name}/${variant.nameSuffix}`) derived from
 * `routes.ts`. These are the exceptions — surfaces a spec scans directly, which
 * therefore have no entry in the route table. The list is sanctioned rather
 * than derived because the alternative is a guard that cannot tell a renamed
 * route from a component scan, and so cannot reject either.
 *
 * `coverage.meta.spec.ts` checks every key below is still passed as a string
 * literal to an `assertNoBlocking*` call in an `e2e/tests/a11y/*.spec.ts`
 * source (see {@link extractScannedKeys}), so a deleted or renamed surface
 * leaves its entry here unreferenced. It matches call arguments rather than raw
 * text, so a key surviving only in a comment does not satisfy it. What it does
 * not check is *which* spec scans the key — the enumeration records no owner —
 * so moving a surface between a11y specs keeps its entry valid.
 *
 * Adding a surface is the other direction and is not enforced: an un-enumerated
 * surface only matters once someone baselines it, and the stale key message
 * says what to do at that point.
 *
 * `search/default` is intentionally absent: the deep-tier suite scans a surface
 * under that name, but it is also a `routes.ts` variant target, so it is
 * already a known key.
 */
export const nonRouteScanKeys: readonly string[] = [
  // Component surfaces scanned by routes-sweep.spec.ts ("a11y component surfaces").
  "taxonomy-metadata-distributions",
  "command-palette",
  "auspice-picker",
  "auspice-viewer-host",
  "auspice-viewer-iframe",
  // Interaction states scanned by deep-tier.spec.ts.
  "genome-assembly/validation-errors",
  "genome-assembly/file-picker-open",
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

/**
 * Scan keys a spec source passes as a string literal to an `assertNoBlocking*`
 * call — the first literal inside each call's own argument list.
 *
 * Walks the argument list with a paren counter rather than using one regex: the
 * sweep also calls `assertNoBlockingViolations(violations, target.name, theme)`
 * with no literal at all, and a regex that simply scanned forward for the next
 * `"` would attribute an unrelated literal from further down the file to it.
 * Calls whose argument list holds no double-quoted literal contribute nothing.
 */
export function extractScannedKeys(source: string): string[] {
  const keys: string[] = [];
  const callPattern = /assertNoBlocking\w*\(/g;
  let call: RegExpExecArray | null;
  while ((call = callPattern.exec(source)) !== null) {
    let depth = 1;
    let quote: string | null = null;
    let literal: string | null = null;
    let current = "";
    for (let i = call.index + call[0].length; i < source.length; i++) {
      const char = source[i];
      if (quote) {
        if (char === "\\") {
          current += source[i + 1] ?? "";
          i++;
        } else if (char === quote) {
          if (quote === '"' && literal === null) literal = current;
          quote = null;
        } else {
          current += char;
        }
        continue;
      }
      if (char === '"' || char === "'" || char === "`") {
        quote = char;
        current = "";
        continue;
      }
      if (char === "(") depth++;
      else if (char === ")" && --depth === 0) break;
    }
    if (literal !== null) keys.push(literal);
  }
  return keys;
}

/**
 * The baseline map's route dimension accepts this wildcard (see `lookupEntry`
 * in `baseline.ts`). `reflowSkip` does not — `isReflowSkipped` tests plain key
 * membership — so a `"*"` there would be dead weight and is reported as stale.
 */
export const baselineWildcardKey = "*";

/** Every scan key a suppression may be keyed by, excluding the wildcard. */
export const knownScanKeys: ReadonlySet<string> = new Set([
  ...scanTargets.map((target) => target.name),
  ...nonRouteScanKeys,
]);

export interface StaleScanKeyOptions {
  /** Accept the baseline wildcard route key. Pass `false` for `reflowSkip`. */
  allowWildcard: boolean;
}

/** Keys that match no current scan target and no sanctioned non-route scan. */
export function findStaleScanKeys(
  keys: readonly string[],
  { allowWildcard }: StaleScanKeyOptions,
): string[] {
  return keys.filter((key) => {
    if (allowWildcard && key === baselineWildcardKey) return false;
    return !knownScanKeys.has(key);
  });
}

/** Failure message naming every stale key and what to do about it. */
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
