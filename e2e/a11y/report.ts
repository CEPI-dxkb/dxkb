import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import type { Violation } from "./gate";

export interface ScanRecord {
  route: string;
  theme: string;
  blocking: Violation[];
  suppressed: Violation[];
  warnings: Violation[];
}

/** Artifact root for the a11y sweep's JSON report, scan records and summary. */
export const a11yReportDir = ".misc/a11y-report";

/** Aggregated per-route/theme scan summary, one file per invocation. */
export const a11ySummaryPath = path.join(a11yReportDir, "a11y-summary.json");

/**
 * Env var carrying the id of the current `playwright test` invocation.
 *
 * `e2e/a11y/setup.ts` assigns it in the config process before any worker forks,
 * so every worker of one invocation — and the global teardown that aggregates
 * them — agree on the same value.
 */
export const a11yRunIdEnvVar = "A11Y_RUN_ID";

const scansRoot = path.join(a11yReportDir, "scans");

/**
 * Directory holding this invocation's scan records.
 *
 * Records are written per invocation rather than into one flat folder: the
 * teardown aggregates whatever it finds, so a shared folder let a previous
 * run's records leak into this run's summary (and into the `maxNodes` values
 * `pnpm a11y:baseline:update` derives from it). The `unscoped` fallback only
 * applies if these helpers are used outside a Playwright run that loaded the
 * global setup — recorder and aggregator still agree, so the pairing holds.
 */
export function currentScansDir(): string {
  return path.join(scansRoot, process.env[a11yRunIdEnvVar] ?? "unscoped");
}

export function recordScan(record: ScanRecord): void {
  const scansDir = currentScansDir();
  fs.mkdirSync(scansDir, { recursive: true });
  const safeName = `${record.route}__${record.theme}`.replace(
    /[^a-z0-9_-]/gi,
    "_",
  );
  const filename = `${safeName}__${String(process.pid)}__${randomUUID()}.json`;
  fs.writeFileSync(path.join(scansDir, filename), JSON.stringify(record));
}
