import { defineConfig, devices } from "@playwright/test";
import { e2eSignedInStatePath } from "./e2e/auth/storage-state";

const port = Number(process.env.E2E_PORT ?? 3020);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${String(port)}`;
const isCi = Boolean(process.env.CI);

// The wrapper loads .env.e2e.local and .env.e2e.test, then runs `next start`
// (run `pnpm build` first). The loopback env is required or server components
// make outbound fetches `page.route()` cannot intercept. `node --env-file` is
// not usable: it leaks into NODE_OPTIONS, which Next's workers reject.
const webServerCommand = `node e2e/scripts/start-webserver.mjs ${String(port)}`;

// Report and artifact folders live under /.misc; `snapshotDir` and
// `e2e/.auth/` sit outside on purpose. The html reporter is set explicitly
// because its default would collide with playwright.a11y.config.ts.
const htmlReportDir = ".misc/playwright-report";

export default defineConfig({
  testDir: "./e2e",
  // Excludes tests/a11y/ — those run via playwright.a11y.config.ts (pnpm a11y).
  testMatch: /tests\/(?!a11y\/).*\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  workers: isCi ? 2 : undefined,
  reporter: isCi
    ? [["github"], ["html", { open: "never", outputFolder: htmlReportDir }]]
    : [["list"], ["html", { open: "never", outputFolder: htmlReportDir }]],
  outputDir: ".misc/test-results",
  snapshotDir: "e2e/__snapshots__",
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0,
      animations: "disabled",
      caret: "hide",
    },
  },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "setup-signed-in",
      testMatch: /auth\/signed-in\.setup\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "setup-public",
      testMatch: /auth\/public\.setup\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: e2eSignedInStatePath,
      },
      dependencies: ["setup-signed-in"],
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        storageState: e2eSignedInStatePath,
      },
      dependencies: ["setup-signed-in"],
      expect: {
        toHaveScreenshot: {
          maxDiffPixelRatio: 0.05,
          animations: "disabled",
          caret: "hide",
        },
      },
    },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        storageState: e2eSignedInStatePath,
      },
      dependencies: ["setup-signed-in"],
      expect: {
        toHaveScreenshot: {
          maxDiffPixelRatio: 0.05,
          animations: "disabled",
          caret: "hide",
        },
      },
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
