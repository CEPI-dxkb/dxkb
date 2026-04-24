import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3020);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;
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
const webServerCommand = `node e2e/scripts/start-webserver.mjs ${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /tests\/.*\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  workers: isCi ? 2 : undefined,
  reporter: isCi ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  outputDir: "test-results",
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
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup-signed-in"],
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        storageState: "e2e/.auth/user.json",
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
        storageState: "e2e/.auth/user.json",
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
