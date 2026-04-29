import type { JourneyDriver } from "../record-har";
import { signIn, getUserId } from "./_helpers/sign-in";

/**
 * Sign in, navigate to the test user's workspace home, and wait until the
 * file listing has rendered (or surfaced the empty-folder state). Captures:
 *
 *  - `Workspace.ls` for the home directory (the workspace browser's primary
 *    backend call)
 *  - `Workspace.get` for `favorites.json` (the favorites loader fires on
 *    every workspace mount)
 *  - any `/api/workspace/*` proxy calls the listing triggers
 *
 * Replayed by `workspace-browse.spec.ts` to assert the spec's overrides
 * still match the real BV-BRC response shape. Does NOT click into a
 * sub-folder — sub-folders depend on what the test account happens to
 * contain, which violates the determinism rule in
 * `e2e/scripts/journeys/README.md`.
 */
export const drive: JourneyDriver = async (page, env) => {
  await signIn(page, env);
  const userId = await getUserId(page);

  await page.goto(`${env.baseURL}/workspace/${encodeURIComponent(userId)}/home`);
  await page
    .getByRole("navigation", { name: /workspace path/i })
    .waitFor({ state: "visible", timeout: 30_000 });

  // Wait for either at least one row OR the empty-state copy. The workspace
  // browser also renders an error alert if `Workspace.ls` fails — fail loudly
  // here rather than committing a HAR that captures the error path silently.
  await page.waitForFunction(
    () => {
      const rows = document.querySelectorAll("tbody tr");
      const text = document.body.textContent?.toLowerCase() ?? "";
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
