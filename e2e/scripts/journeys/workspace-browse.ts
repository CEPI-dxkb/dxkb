import type { JourneyDriver } from "../record-har";
import { signIn, getUserId } from "./_helpers/sign-in";

/**
 * Signs in, loads the workspace home and waits for the listing, capturing
 * `Workspace.ls`, the `favorites.json` `Workspace.get` and proxy calls. It
 * does not enter a sub-folder, which would depend on the account's contents
 * (see `e2e/scripts/journeys/README.md`).
 */
export const drive: JourneyDriver = async (page, env) => {
  await signIn(page, env);
  const userId = await getUserId(page);

  await page.goto(`${env.baseURL}/workspace/${encodeURIComponent(userId)}/home`);
  await page
    .getByRole("navigation", { name: /workspace path/i })
    .waitFor({ state: "visible", timeout: 30_000 });

  // Wait for a row or the empty state; fail loudly on an error alert rather
  // than commit a HAR of the error path.
  await page.waitForFunction(
    () => {
      const rows = document.querySelectorAll("tbody tr");
      const text = document.body.textContent.toLowerCase();
      const empty = text.includes("this folder is empty");
      const error = text.includes("failed to load workspace contents");
      if (error) throw new Error("Workspace.ls returned an error during recording");
      return rows.length > 0 || empty;
    },
    null,
    { timeout: 30_000 },
  );
  await page.waitForLoadState("networkidle", { timeout: 30_000 });
};
