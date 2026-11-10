import type { JourneyDriver } from "../record-har";
import { signIn, getUserId } from "./_helpers/sign-in";

/**
 * Drives the upload dialog on `home/.e2e-records/` with a generated text
 * file, capturing the upload POST and the post-upload `Workspace.ls`. It
 * writes to real BV-BRC storage, so it is `workflow_dispatch`-only; create
 * that folder once by hand on the test user.
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

  // Timestamped name avoids the duplicate-name overwrite prompt.
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

  await dialog.waitFor({ state: "hidden", timeout: 30_000 });
  await page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: fileName, exact: true }) })
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 });
};
