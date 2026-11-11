import { defineConfig, devices } from "@playwright/test";
import { a11ySignedInStatePath } from "./e2e/auth/storage-state";

const port = Number(process.env.E2E_PORT ?? 3020);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${String(port)}`;
const isCi = Boolean(process.env.CI);

// Same wrapper as playwright.config.ts — loads .env.e2e.* and starts next
// start.
const webServerCommand = `node e2e/scripts/start-webserver.mjs ${String(port)}`;

// Every browser project restates this because a project-level `testMatch`
// replaces the config-level one; otherwise they would also run the auth setup
// files concurrently with the tests that read their storage state.
// coverage.meta.spec.ts runs under playwright.a11y.meta.config.ts.
const a11ySpecs = /tests\/a11y\/(?!coverage\.meta\.spec\.ts$).*\.spec\.ts$/;

export default defineConfig({
  // globalSetup stamps A11Y_RUN_ID; globalTeardown aggregates only that run's
  // scan records.
  globalSetup: "./e2e/a11y/setup.ts",
  globalTeardown: "./e2e/a11y/teardown.ts",
  testDir: "./e2e",
  // Includes the auth setup files; excludes coverage.meta.spec.ts (see the
  // meta config).
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
    // Reuses the shared setup scripts, which resolve their destination from
    // the project name so the two configs never write the same file;
    // `dependencies` runs it first even under fullyParallel.
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

    {
      name: "a11y-chromium",
      testMatch: a11ySpecs,
      use: {
        ...devices["Desktop Chrome"],
        storageState: a11ySignedInStatePath,
      },
      dependencies: ["a11y-setup-signed-in"],
    },

    // Specs filter with test.skip on projectName including "tripwire".
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
