import type { JourneyDriver } from "../record-har";
import { signIn } from "./_helpers/sign-in";

/**
 * Sign in, navigate to `/jobs`, and wait for the list to hydrate. Captures
 * the `/api/services/app-service/jobs/enumerate-tasks-filtered` POST plus
 * whatever counters / sidebar fetches the page fires on first paint.
 *
 * Does NOT select a row, kill a job, or open stdout — those would either
 * write to remote state (kill) or depend on the test account's job history
 * (which churns and would yank the HAR every refresh). The list call alone
 * is the structurally stable surface that `jobs-lifecycle.spec.ts` and
 * `jobs.spec.ts` need to validate against.
 */
export const drive: JourneyDriver = async (page, env) => {
  await signIn(page, env);

  await page.goto(`${env.baseURL}/jobs`);
  await page
    .getByRole("heading", { level: 1, name: /^jobs$/i })
    .waitFor({ state: "visible", timeout: 30_000 });

  // Either rows render (account has jobs) or the empty-state copy renders
  // (fresh account). Both are valid HAR captures of the enumerate response.
  await page.waitForFunction(
    () => {
      const rows = document.querySelectorAll("tbody tr");
      const text = document.body.textContent?.toLowerCase() ?? "";
      return rows.length > 0 || text.includes("no jobs");
    },
    null,
    { timeout: 30_000 },
  );
  await page.waitForLoadState("networkidle", { timeout: 30_000 });
};
