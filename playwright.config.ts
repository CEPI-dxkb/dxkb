import { defineConfig, devices } from "@playwright/test";
import { e2eSignedInStatePath } from "./e2e/auth/storage-state";

const port = Number(process.env.E2E_PORT ?? 3020);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${String(port)}`;
const isCi = Boolean(process.env.CI);

// The wrapper loads .env.e2e.local (gitignored, dev overrides) + .env.e2e.test
// (committed defaults) into process.env, then runs `next start`. Caller must
// already have a valid .next/ build — run `pnpm build` first. We deliberately
// do not invoke `next build` inside the wrapper because a cold build exceeds
// the webServer timeout and blocks targeted runs.
//
// Without the loopback env overrides, server components make real outbound
// fetches that Playwright's page.route() can't intercept, and the test server
// spams "JSON-RPC call failed: HTTP error! status: 500". We can't use node's
// --env-file flag directly: it leaks into NODE_OPTIONS and Next's worker
// threads reject NODE_OPTIONS containing --env-file.
const webServerCommand = `node e2e/scripts/start-webserver.mjs ${String(port)}`;

// Every *report and artifact* folder this config writes lives under /.misc,
// per AGENTS.md's file-structure rule — this html report and `outputDir`
// below. Two paths it writes sit outside /.misc on purpose and are not
// artifacts: `snapshotDir` (`e2e/__snapshots__`, committed visual baselines —
// .gitignore says so in place) and the `e2e/.auth/` storage state (gitignored
// at .gitignore's `/e2e/.auth/`).
//
// The html reporter would otherwise default to `playwright-report/` at the
// repo root, which breaks that rule and is also the default
// playwright.a11y.config.ts would land on, so both configs set it explicitly
// rather than sharing one directory.
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
