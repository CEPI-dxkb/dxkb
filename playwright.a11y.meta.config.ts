import { defineConfig } from "@playwright/test";

const isCi = Boolean(process.env.CI);

/**
 * Browser-free a11y metadata checks (`coverage.meta.spec.ts`). Kept off
 * `playwright.a11y.config.ts` because Playwright clears `outputDir` and
 * rewrites the JSON report each run, so the last command would destroy the
 * other's artifacts. No webServer, globalSetup or storageState: nothing here
 * navigates, scans or authenticates.
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
