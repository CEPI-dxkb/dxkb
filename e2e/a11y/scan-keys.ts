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
 * `coverage.meta.spec.ts` checks every key below is still passed as a top-level
 * string literal to an `assertNoBlocking*` call in an `e2e/tests/a11y/*.spec.ts`
 * source (see {@link extractScannedKeys}), so a deleted or renamed surface
 * leaves its entry here unreferenced.
 *
 * Two limits of that check, stated so nobody has to re-derive them:
 *
 * - It does not record *which* spec scans a key, so moving a surface between
 *   a11y specs keeps its entry valid.
 * - It only recognises a plain double-quoted literal in the call's own argument
 *   list. A key passed as a template literal, a single-quoted string, a
 *   variable or a concatenation is *not* recognised — the entry is reported as
 *   unreferenced. That direction is safe (it fails loudly rather than
 *   accepting), but if a key you are sure is scanned is rejected, this is why:
 *   pass it as a plain `"double-quoted"` literal.
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
 * Remove line and block comments, leaving string and template literals intact.
 *
 * A lexical approximation, not a parser: it tracks quotes so a `//` inside a
 * string survives, and it declines to start a line comment on a backslash-
 * escaped slash so a regex literal ending `\//` is not mistaken for one. If it
 * ever over-strips, the consequence is that a real `assertNoBlocking*` call
 * disappears and its key is reported as unreferenced — loud, not silent. The
 * unsafe direction is under-stripping, which is what this exists to prevent.
 */
function stripComments(source: string): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];
    if (char === '"' || char === "'" || char === "`") {
      out += char;
      i++;
      while (i < source.length) {
        if (source[i] === "\\") {
          out += source.slice(i, i + 2);
          i += 2;
          continue;
        }
        out += source[i];
        const closed = source[i] === char;
        i++;
        if (closed) break;
      }
      continue;
    }
    if (char === "/" && next === "/" && source[i - 1] !== "\\") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (char === "/" && next === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += char;
    i++;
  }
  return out;
}

/**
 * Scan keys a spec source passes to an `assertNoBlocking*` call: the first
 * double-quoted literal at the *top level* of that call's own argument list.
 *
 * Three properties, each there because its absence miscredited a key:
 *
 * - Comments are stripped first, so neither a commented-out call nor a comment
 *   sitting inside a live call's argument list can supply a key.
 * - The argument list is walked with a bracket counter rather than matched with
 *   one regex, because the sweep also calls
 *   `assertNoBlockingViolations(violations, target.name, theme)` with no
 *   literal at all; a regex scanning forward for the next `"` would hand it an
 *   unrelated literal from further down the file.
 * - Only depth-1 literals count, so a nested call's or object literal's string
 *   — `assertNoBlocking(scanPage(page, "not-a-key"), name, theme)` — is not
 *   mistaken for the scan key.
 *
 * Calls with no qualifying literal contribute nothing.
 */
export function extractScannedKeys(source: string): string[] {
  const keys: string[] = [];
  const stripped = stripComments(source);
  const callPattern = /assertNoBlocking\w*\(/g;
  let call: RegExpExecArray | null;
  while ((call = callPattern.exec(stripped)) !== null) {
    let depth = 1;
    let quote: string | null = null;
    let quoteDepth = 0;
    let literal: string | null = null;
    let current = "";
    for (let i = call.index + call[0].length; i < stripped.length; i++) {
      const char = stripped[i];
      if (quote) {
        if (char === "\\") {
          current += stripped[i + 1] ?? "";
          i++;
        } else if (char === quote) {
          if (quote === '"' && literal === null && quoteDepth === 1) {
            literal = current;
          }
          quote = null;
        } else {
          current += char;
        }
        continue;
      }
      if (char === '"' || char === "'" || char === "`") {
        quote = char;
        quoteDepth = depth;
        current = "";
        continue;
      }
      if (char === "(" || char === "[" || char === "{") depth++;
      else if (char === "]" || char === "}") depth--;
      else if (char === ")") {
        depth--;
        if (depth === 0) break;
      }
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
