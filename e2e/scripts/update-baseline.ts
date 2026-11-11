import * as fs from "fs";
import type { Violation } from "../a11y/gate";
import { a11ySummaryPath, type ScanRecord } from "../a11y/report";

const baselinePath = "e2e/a11y/baseline.generated.ts";
const headroom = 5;

function buildObservedMaps(records: ScanRecord[]): {
  routeObs: Map<string, number>;
  wildcardObs: Map<string, number>;
} {
  const routeObs = new Map<string, number>();
  const wildcardObs = new Map<string, number>();

  function observe(route: string, theme: string, v: Violation): void {
    if (v.impact === "critical") return;
    const count = v.nodes.length;
    const rKey = `${route}::${theme}::${v.id}`;
    routeObs.set(rKey, Math.max(routeObs.get(rKey) ?? 0, count));
    const wKey = `${theme}::${v.id}`;
    wildcardObs.set(wKey, Math.max(wildcardObs.get(wKey) ?? 0, count));
  }

  // Observe only baseline-suppressed violations: observing r.blocking would
  // raise maxNodes to absorb unbaselined regressions.
  for (const r of records) {
    for (const v of r.suppressed) observe(r.route, r.theme, v);
  }

  return { routeObs, wildcardObs };
}

function updateBaseline(
  source: string,
  routeObs: Map<string, number>,
  wildcardObs: Map<string, number>,
): { updated: string; changes: number } {
  const lines = source.split("\n");
  let currentRoute: string | null = null;
  let currentTheme: string | null = null;
  let changes = 0;

  const updated = lines.map((line) => {
    if (/^ {2}\},?/.test(line)) {
      currentRoute = null;
      currentTheme = null;
      return line;
    }
    if (/^ {4}\},?/.test(line)) {
      currentTheme = null;
      return line;
    }
    const routeMatch = line.match(/^ {2}"([^"]+)":\s*\{/);
    if (routeMatch) {
      currentRoute = routeMatch[1];
      return line;
    }
    const themeMatch = line.match(/^ {4}"(dxkb-[^"]+)":\s*\{/);
    if (themeMatch) {
      currentTheme = themeMatch[1];
      return line;
    }
    const ruleMatch = line.match(/^( {6}"([^"]+)":\s*\{\s*maxNodes:\s*)(\d+)(.*)/);
    if (ruleMatch && currentRoute && currentTheme) {
      const [, prefix, ruleId, oldStr, suffix] = ruleMatch;
      const oldMax = Number(oldStr);

      const obs =
        currentRoute === "*"
          ? wildcardObs.get(`${currentTheme}::${ruleId}`)
          : routeObs.get(`${currentRoute}::${currentTheme}::${ruleId}`);

      if (obs !== undefined) {
        const newMax = obs + headroom;
        if (newMax !== oldMax) {
          console.log(
            `  ${currentRoute}/${currentTheme}/${ruleId}: ${String(oldMax)} → ${String(newMax)}`,
          );
          changes++;
          return `${prefix}${String(newMax)}${suffix}`;
        }
      }
    }
    return line;
  });

  return { updated: updated.join("\n"), changes };
}

function main(): void {
  if (!fs.existsSync(a11ySummaryPath)) {
    console.error(`${a11ySummaryPath} not found — run pnpm a11y:routes first.`);
    process.exit(1);
  }

  const records: ScanRecord[] = JSON.parse(fs.readFileSync(a11ySummaryPath, "utf8")) as ScanRecord[];
  const source = fs.readFileSync(baselinePath, "utf8");

  const { routeObs, wildcardObs } = buildObservedMaps(records);
  const { updated, changes } = updateBaseline(source, routeObs, wildcardObs);

  if (changes === 0) {
    console.log("baseline.generated.ts — no changes needed.");
    return;
  }

  fs.writeFileSync(baselinePath, updated);
  console.log(`\nbaseline.generated.ts updated (${String(changes)} change(s)).`);
}

main();
