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
 * `coverage.meta.spec.ts` checks every key below still appears as a literal in
 * an `e2e/tests/a11y/*.spec.ts` source, so an entry cannot outlive the scan it
 * names. Adding a surface is the other direction and is not enforced: an
 * un-enumerated surface only matters once someone baselines it, and the stale
 * key message says what to do at that point.
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
 * The baseline map's route dimension accepts this wildcard (see `lookupEntry`
 * in `baseline.ts`). `reflowSkip` does not — `isReflowSkipped` tests plain key
 * membership — so a `"*"` there would be dead weight and is reported as stale.
 */
export const baselineWildcardKey = "*";

/** Every scan key a suppression may legitimately be keyed by. */
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
