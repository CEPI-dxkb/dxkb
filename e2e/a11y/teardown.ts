import * as fs from "fs";
import * as path from "path";
import {
  a11yReportDir,
  a11ySummaryPath,
  currentScansDir,
  type ScanRecord,
} from "./report";

/**
 * Aggregate this invocation's scan records into one summary.
 *
 * Only this invocation's directory is read and removed, so a later run — or a
 * setup-only invocation, which records nothing and therefore returns early —
 * neither absorbs nor deletes another run's evidence.
 */
export default function globalTeardown(): void {
  const scansDir = currentScansDir();
  if (!fs.existsSync(scansDir)) return;

  const files = fs.readdirSync(scansDir).filter((f) => f.endsWith(".json"));
  const records: ScanRecord[] = files.map(
    (f) => JSON.parse(fs.readFileSync(path.join(scansDir, f), "utf8")) as ScanRecord,
  );

  // Deduplicate by route+theme (same test may run in multiple workers).
  const seen = new Map<string, ScanRecord>();
  for (const r of records) {
    const key = `${r.route}::${r.theme}`;
    if (!seen.has(key)) seen.set(key, r);
  }

  const summary = [...seen.values()].sort(
    (a, b) => a.route.localeCompare(b.route) || a.theme.localeCompare(b.theme),
  );

  fs.mkdirSync(a11yReportDir, { recursive: true });
  fs.writeFileSync(a11ySummaryPath, JSON.stringify(summary, null, 2));
  // Raw records are consumed now; the summary is the artifact worth keeping.
  fs.rmSync(scansDir, { recursive: true, force: true });
}
