import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import type { Violation } from "./gate";

export interface ScanRecord {
  project: string;
  route: string;
  theme: string;
  retry: number;
  blocking: Violation[];
  suppressed: Violation[];
  warnings: Violation[];
}

export const a11yReportDir = ".misc/a11y-report";

export const a11ySummaryPath = path.join(a11yReportDir, "a11y-summary.json");

/**
 * Id of the current `playwright test` invocation, assigned in
 * `e2e/a11y/setup.ts` before workers fork so workers and the teardown agree.
 */
export const a11yRunIdEnvVar = "A11Y_RUN_ID";

const scansRoot = path.join(a11yReportDir, "scans");

/**
 * Per-invocation, so a previous run's records cannot leak into this summary
 * or the `maxNodes` values `pnpm a11y:baseline:update` derives.
 */
export function currentScansDir(): string {
  return path.join(scansRoot, process.env[a11yRunIdEnvVar] ?? "unscoped");
}

export function recordScan(record: ScanRecord): void {
  const scansDir = currentScansDir();
  fs.mkdirSync(scansDir, { recursive: true });
  const safeName =
    `${record.project}__${record.route}__${record.theme}`.replace(
      /[^a-z0-9_-]/gi,
      "_",
    );
  const filename = `${safeName}__${String(process.pid)}__${randomUUID()}.json`;
  fs.writeFileSync(path.join(scansDir, filename), JSON.stringify(record));
}
