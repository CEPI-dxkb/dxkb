import type { JourneyDriver } from "../record-har";
import { signIn, getUserId } from "./_helpers/sign-in";

/**
 * Opens a seeded text file to capture `/api/workspace/view/<path>` and the
 * parent `Workspace.ls`. Requires `home/e2e-fixtures/readme.txt` (small
 * ASCII) on the test user; the path is baked into the HAR, so changing it
 * means re-seeding.
 */
export const drive: JourneyDriver = async (page, env) => {
  await signIn(page, env);
  const userId = await getUserId(page);

  await page.goto(
    `${env.baseURL}/workspace/${encodeURIComponent(userId)}/home/e2e-fixtures`,
  );
  await page
    .getByRole("navigation", { name: /workspace path/i })
    .waitFor({ state: "visible", timeout: 30_000 });

  const row = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "readme.txt", exact: true }) })
    .first();
  await row.waitFor({ state: "visible", timeout: 30_000 });

  // Wait for CodeMirror to populate so the view GET lands in the HAR.
  await row.click();
  await page
    .locator(".cm-content")
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 });
};
