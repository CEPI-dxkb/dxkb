/**
 * One-shot seeder for the BV-BRC test account used by the journey recorders.
 *
 * Drives the running production app (default `http://127.0.0.1:3010`, override
 * with `E2E_RECORD_BASE_URL`) with the credentials in `.env.e2e` and creates
 * the fixtures that `workspace-viewer` and `workspace-upload` depend on:
 *
 *   home/
 *     e2e-fixtures/
 *       readme.txt        (uploaded with a small ASCII payload)
 *     .e2e-records/       (empty folder for upload-driver writes)
 *
 * Idempotent: if a folder or file already exists, the corresponding step is
 * skipped rather than failing the run. Safe to re-run after partial seeding.
 *
 * Usage (with `pnpm build && pnpm start` already running on port 3010):
 *
 *     pnpm tsx e2e/scripts/seed-account.ts
 */

import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

import { signIn, getUserId } from "./journeys/_helpers/sign-in";

function loadEnvE2e(): void {
  const envPath = path.resolve(process.cwd(), ".env.e2e");
  if (!fs.existsSync(envPath)) {
    console.error("Missing .env.e2e. Copy .env.e2e.example and fill in credentials.");
    process.exit(1);
  }
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (match) process.env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
}

async function main(): Promise<void> {
  loadEnvE2e();
  const baseURL = process.env.E2E_RECORD_BASE_URL ?? "http://127.0.0.1:3010";
  const user = process.env.E2E_TEST_USER ?? "";
  const password = process.env.E2E_TEST_PASSWORD ?? "";

  const browser = await chromium.launch({ headless: process.env.E2E_RECORD_HEADED !== "1" });
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  try {
    console.log(`Signing in to ${baseURL} as ${user}…`);
    await signIn(page, { baseURL, user, password });
    const userId = await getUserId(page);
    const homeUrl = `${baseURL}/workspace/${encodeURIComponent(userId)}/home`;

    await ensureFolder(page, homeUrl, "e2e-fixtures");
    await ensureFolder(page, homeUrl, ".e2e-records");
    await ensureReadmeInFixtures(page, baseURL, userId);

    console.log("Seeding complete.");
  } finally {
    await context.close();
    await browser.close();
  }
}

async function ensureFolder(
  page: import("@playwright/test").Page,
  homeUrl: string,
  folderName: string,
): Promise<void> {
  await page.goto(homeUrl);
  await page
    .getByRole("navigation", { name: /workspace path/i })
    .waitFor({ state: "visible", timeout: 30_000 });

  // Show-hidden so dot-prefix folders (`.e2e-records`) are visible to the
  // existence check. The toolbar button toggles between "Show hidden" and
  // "Hide hidden"; click it only if currently in the "Show" state.
  const showHidden = page.getByRole("button", { name: /^show hidden$/i });
  if (await showHidden.isVisible().catch(() => false)) {
    await showHidden.click();
  }

  const existingRow = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: folderName, exact: true }) });
  if ((await existingRow.count()) > 0) {
    console.log(`  ✓ ${folderName}/ already exists`);
    return;
  }

  console.log(`  + creating ${folderName}/`);
  await page.getByRole("button", { name: /^new folder$/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 30_000 });
  await dialog.getByPlaceholder("My Folder").fill(folderName);
  await dialog.getByRole("button", { name: /^create folder$/i }).click();
  await dialog.waitFor({ state: "hidden", timeout: 30_000 });
  // The folder may not appear until Workspace.ls refetches.
  await existingRow.first().waitFor({ state: "visible", timeout: 30_000 });
}

async function ensureReadmeInFixtures(
  page: import("@playwright/test").Page,
  baseURL: string,
  userId: string,
): Promise<void> {
  const fixturesUrl = `${baseURL}/workspace/${encodeURIComponent(userId)}/home/e2e-fixtures`;
  await page.goto(fixturesUrl);
  await page
    .getByRole("navigation", { name: /workspace path/i })
    .waitFor({ state: "visible", timeout: 30_000 });

  const existingRow = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "readme.txt", exact: true }) });
  if ((await existingRow.count()) > 0) {
    console.log("  ✓ e2e-fixtures/readme.txt already exists");
    return;
  }

  console.log("  + uploading e2e-fixtures/readme.txt");
  await page.getByRole("button", { name: /^upload$/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 30_000 });

  await page.locator('input[type="file"]').setInputFiles({
    name: "readme.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("e2e seed fixture — do not delete\n"),
  });
  await dialog.getByText("readme.txt").waitFor({ state: "visible", timeout: 30_000 });
  await dialog.getByRole("button", { name: /^start upload$/i }).click();
  await dialog.waitFor({ state: "hidden", timeout: 60_000 });
  await existingRow.first().waitFor({ state: "visible", timeout: 30_000 });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
