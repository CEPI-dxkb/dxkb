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

  // Retries may repeat an identical scan. Different evidence under one key means two
  // surfaces collided and must be named separately rather than silently dropping one.
  const seen = new Map<string, ScanRecord>();
  for (const record of records) {
    const key = `${record.route}::${record.theme}`;
    const previous = seen.get(key);
    if (previous && JSON.stringify(previous) !== JSON.stringify(record)) {
      throw new Error(`Conflicting accessibility scan records for ${key}`);
    }
    seen.set(key, record);
  }

  const summary = [...seen.values()].sort(
    (a, b) => a.route.localeCompare(b.route) || a.theme.localeCompare(b.theme),
  );

  fs.mkdirSync(a11yReportDir, { recursive: true });
  fs.writeFileSync(a11ySummaryPath, JSON.stringify(summary, null, 2));
  // Raw records are consumed now; the summary is the artifact worth keeping.
  fs.rmSync(scansDir, { recursive: true, force: true });
}
