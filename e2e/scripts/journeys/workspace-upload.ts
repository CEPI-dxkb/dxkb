import type { JourneyDriver } from "../record-har";
import { signIn, getUserId } from "./_helpers/sign-in";

/**
 * Sign in, navigate to a sandbox folder on the test account, and drive the
 * upload dialog with a tiny generated text file. Captures:
 *
 *  - `POST /api/services/workspace/upload` (the multipart upload endpoint)
 *  - the post-upload `Workspace.ls` refetch that brings the new row in
 *
 * ## Why this is `workflow_dispatch`-only
 *
 * This driver writes a real file to remote BV-BRC storage every time it
 * runs. We do NOT want bi-weekly cron invocations silently appending files
 * to the test account: it would mask a regression in cleanup and leave a
 * trail of `recorded-*.txt` debris that's annoying to triage. Manual dispatch
 * keeps the cadence in human hands.
 *
 * ## Required test-account seeding
 *
 * The driver navigates to `home/.e2e-records/` and expects that folder to
 * already exist (dot-prefix so it stays out of the default listing). Create
 * it once by hand on the BV-BRC test user via the workspace UI. Files
 * uploaded by this driver accumulate there; sweep periodically.
 */
export const drive: JourneyDriver = async (page, env) => {
  await signIn(page, env);
  const userId = await getUserId(page);

  await page.goto(
    `${env.baseURL}/workspace/${encodeURIComponent(userId)}/home/.e2e-records`,
  );
  await page
    .getByRole("navigation", { name: /workspace path/i })
    .waitFor({ state: "visible", timeout: 30_000 });

  await page.getByRole("button", { name: /^upload$/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 30_000 });

  // Timestamped name keeps each refresh distinguishable from prior runs and
  // sidesteps the duplicate-name overwrite prompt.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `recorded-${stamp}.txt`;
  await page.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: "text/plain",
    buffer: Buffer.from(`e2e har-recorder upload at ${stamp}\n`),
  });
  await dialog.getByText(fileName).waitFor({ state: "visible", timeout: 30_000 });

  const uploadResponse = page.waitForResponse(
    (res) =>
      res.url().endsWith("/api/services/workspace/upload") &&
      res.request().method() === "POST",
    { timeout: 60_000 },
  );
  await dialog.getByRole("button", { name: /^start upload$/i }).click();
  await uploadResponse;

  // Wait until the dialog dismisses and the new row appears in the listing
  // — that's the post-upload `Workspace.ls` refetch we want in the HAR.
  await dialog.waitFor({ state: "hidden", timeout: 30_000 });
  await page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: fileName, exact: true }) })
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 });
};
