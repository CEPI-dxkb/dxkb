import { randomUUID } from "node:crypto";
import { a11yRunIdEnvVar } from "./report";

/**
 * Stamp this `playwright test` invocation with an id.
 *
 * Runs in the config process before any worker forks, so the value reaches
 * every worker (and the global teardown) through the inherited environment.
 * `recordScan` files its records under that id and the teardown aggregates only
 * that directory, which is what keeps one invocation's summary free of another
 * invocation's records. Assigned unconditionally: an inherited value would
 * merge two invocations into one report area, which is the defect this removes.
 */
export default function globalSetup(): void {
  process.env[a11yRunIdEnvVar] =
    `${String(Date.now())}-${randomUUID().slice(0, 8)}`;
}
