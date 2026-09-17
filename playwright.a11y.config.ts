import { defineConfig, devices } from "@playwright/test";
import { a11ySignedInStatePath } from "./e2e/auth/storage-state";

const port = Number(process.env.E2E_PORT ?? 3020);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${String(port)}`;
const isCi = Boolean(process.env.CI);

// Same wrapper as playwright.config.ts — loads .env.e2e.* and starts next start.
const webServerCommand = `node e2e/scripts/start-webserver.mjs ${String(port)}`;

// a11y specs minus coverage.meta.spec.ts, which is browser-free and runs under
// playwright.a11y.meta.config.ts so it cannot clear this config's outputDir or
// rewrite its JSON report.
//
// Every browser project restates this, because a project-level `testMatch`
// replaces the config-level one rather than narrowing it. Without it the
// browser projects also match the auth setup files below and run them as
// ordinary tests — which is a third execution of a setup their `dependencies`
// already guarantee, re-writing the storage state its sibling tests are
// concurrently reading under `fullyParallel`.
const a11ySpecs = /tests\/a11y\/(?!coverage\.meta\.spec\.ts$).*\.spec\.ts$/;

export default defineConfig({
  // globalSetup stamps the invocation with A11Y_RUN_ID; globalTeardown
  // aggregates only that invocation's scan records. See e2e/a11y/report.ts.
  globalSetup: "./e2e/a11y/setup.ts",
  globalTeardown: "./e2e/a11y/teardown.ts",
  testDir: "./e2e",
  // a11y specs + auth setup files (setup projects need those to create the
  // storage state below). coverage.meta.spec.ts is excluded on purpose: it is
  // browser-free and runs under playwright.a11y.meta.config.ts, so it cannot
  // clear this config's outputDir or rewrite its JSON report.
  testMatch: [a11ySpecs, /auth\/.*\.setup\.ts$/],
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  workers: isCi ? 4 : undefined,
  reporter: isCi
    ? [
        ["github"],
        ["html", { open: "never", outputFolder: ".misc/a11y-report/html" }],
        ["json", { outputFile: ".misc/a11y-report/results.json" }],
      ]
    : [
        ["list"],
        ["html", { open: "never", outputFolder: ".misc/a11y-report/html" }],
      ],
  outputDir: ".misc/a11y-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Suppress CSS transitions/animations globally so axe scans stable states.
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [
    // Auth setup — reuses the same setup scripts as playwright.config.ts, which
    // resolve their destination from the project name so the two configs do not
    // write the same file. Writes a11ySignedInStatePath, read by every project
    // below; `dependencies` runs it to completion first even under fullyParallel.
    {
      name: "a11y-setup-signed-in",
      testMatch: /auth\/signed-in\.setup\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "a11y-setup-public",
      testMatch: /auth\/public\.setup\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },

    // Deep scan: chromium — runs all a11y specs with full dual-theme.
    {
      name: "a11y-chromium",
      testMatch: a11ySpecs,
      use: {
        ...devices["Desktop Chrome"],
        storageState: a11ySignedInStatePath,
      },
      dependencies: ["a11y-setup-signed-in"],
    },

    // Thin tripwires: webkit + firefox — smoke a representative subset.
    // Specs use test.skip(({ projectName }) => !projectName.includes("tripwire") && ...) for filtering.
    {
      name: "a11y-webkit-tripwire",
      testMatch: a11ySpecs,
      use: {
        ...devices["Desktop Safari"],
        storageState: a11ySignedInStatePath,
      },
      dependencies: ["a11y-setup-signed-in"],
    },
    {
      name: "a11y-firefox-tripwire",
      testMatch: a11ySpecs,
      use: {
        ...devices["Desktop Firefox"],
        storageState: a11ySignedInStatePath,
      },
      dependencies: ["a11y-setup-signed-in"],
    },

    // Mobile thin: chromium at Pixel 5 viewport — high-divergence routes only (Phase 3).
    {
      name: "a11y-mobile-chromium",
      testMatch: a11ySpecs,
      use: {
        ...devices["Pixel 5"],
        storageState: a11ySignedInStatePath,
      },
      dependencies: ["a11y-setup-signed-in"],
    },
  ],
  webServer: {
    command: webServerCommand,
    url: baseURL,
    reuseExistingServer: !isCi,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
