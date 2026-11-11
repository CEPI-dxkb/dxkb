import { randomUUID } from "node:crypto";
import { a11yRunIdEnvVar } from "./report";

/**
 * Stamps this invocation with an id before workers fork, so `recordScan` and
 * the teardown agree on one records directory. Assigned unconditionally: an
 * inherited value would merge two invocations.
 */
export default function globalSetup(): void {
  process.env[a11yRunIdEnvVar] =
    `${String(Date.now())}-${randomUUID().slice(0, 8)}`;
}
