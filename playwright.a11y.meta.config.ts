import { defineConfig } from "@playwright/test";

const isCi = Boolean(process.env.CI);

/**
 * Browser-free a11y metadata checks (`e2e/tests/a11y/coverage.meta.spec.ts`).
 *
 * These assert registry accounting and suppression-key hygiene by reading
 * `routes.ts` and the files on disk — no page, no axe, no server. They used to
 * share `playwright.a11y.config.ts`, which meant they shared its `outputDir`
 * and JSON report path; Playwright clears `outputDir` at the start of every run
 * and the JSON reporter rewrites its file, so whichever a11y command ran last
 * destroyed the other's artifacts and CI had to pin the step order to protect
 * the sweep's traces. Its own config, output directory and report path is what
 * takes that ordering back out of the correctness argument.
 *
 * Deliberately absent, because this suite needs neither:
 * - `webServer` — nothing here navigates, so no `next start` and no build.
 * - `globalSetup` / `globalTeardown` — nothing here records a scan, so there is
 *   no report area to stamp or aggregate, and therefore none to overwrite.
 * - `storageState` — nothing here authenticates.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /tests\/a11y\/coverage\.meta\.spec\.ts$/,
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: isCi,
  retries: 0,
  reporter: isCi
    ? [
        ["github"],
        ["html", { open: "never", outputFolder: ".misc/a11y-meta-report/html" }],
        ["json", { outputFile: ".misc/a11y-meta-report/results.json" }],
      ]
    : [
        ["list"],
        ["html", { open: "never", outputFolder: ".misc/a11y-meta-report/html" }],
      ],
  outputDir: ".misc/a11y-meta-results",
  projects: [{ name: "a11y-meta" }],
});
