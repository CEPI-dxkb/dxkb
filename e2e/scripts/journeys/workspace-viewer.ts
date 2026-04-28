import type { JourneyDriver } from "../record-har";
import { signIn, getUserId } from "./_helpers/sign-in";

/**
 * Sign in, navigate to a known seeded folder, and click a known seeded text
 * file to open the viewer. Captures `/api/workspace/view/<path>` (the file
 * proxy) plus the `Workspace.ls` for the parent folder.
 *
 * ## Required test-account seeding
 *
 * This driver depends on a stable folder + file existing in the test
 * account's home workspace. Seed once by hand on the BV-BRC test user:
 *
 *     home/
 *       e2e-fixtures/
 *         readme.txt    (any small ASCII text content, < 1 KB)
 *
 * The seeded path is captured in the HAR so any change here MUST be paired
 * with a re-seed. We accept the seeding cost because viewer traffic is
 * file-keyed — there's no way to capture a deterministic `view` HAR without
 * a deterministic file to view.
 *
 * Replayed by `workspace-viewer.spec.ts` to validate the spec's hand-rolled
 * file overrides match the real proxy response shape.
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

  // Click triggers selection; the details panel mounts the file viewer once
  // selected. Wait for CodeMirror's content surface to populate so the
  // `/api/workspace/view/...` GET lands in the HAR before we close.
  await row.click();
  await page
    .locator(".cm-content")
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 });
};
