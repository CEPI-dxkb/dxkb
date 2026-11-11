import * as fs from "fs";
import * as path from "path";
import {
  a11yReportDir,
  a11ySummaryPath,
  currentScansDir,
  type ScanRecord,
} from "./report";

/**
 * Aggregates this invocation's scan records into one summary; only its own
 * directory is read and removed.
 */
export default function globalTeardown(): void {
  const scansDir = currentScansDir();
  if (!fs.existsSync(scansDir)) return;

  const files = fs.readdirSync(scansDir).filter((f) => f.endsWith(".json"));
  const records: ScanRecord[] = files.map(
    (f) =>
      JSON.parse(fs.readFileSync(path.join(scansDir, f), "utf8")) as ScanRecord,
  );

  const summary = summarizeScanRecords(records);

  fs.mkdirSync(a11yReportDir, { recursive: true });
  fs.writeFileSync(a11ySummaryPath, JSON.stringify(summary, null, 2));
  fs.rmSync(scansDir, { recursive: true, force: true });
}

export function summarizeScanRecords(records: ScanRecord[]): ScanRecord[] {
  // Keep the latest retry's evidence; a failed attempt can differ from the
  // passing retry.
  const seen = new Map<string, ScanRecord>();
  for (const record of records) {
    const key = `${record.project}::${record.route}::${record.theme}`;
    const previous = seen.get(key);
    if (!previous || record.retry > previous.retry) {
      seen.set(key, record);
      continue;
    }
    if (record.retry < previous.retry) continue;
    if (JSON.stringify(previous) !== JSON.stringify(record)) {
      throw new Error(`Conflicting accessibility scan records for ${key}`);
    }
  }

  return [...seen.values()].sort(
    (a, b) =>
      a.project.localeCompare(b.project) ||
      a.route.localeCompare(b.route) ||
      a.theme.localeCompare(b.theme),
  );
}
