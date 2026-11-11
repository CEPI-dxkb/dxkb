import type { JourneyDriver } from "../record-har";
import { signIn } from "./_helpers/sign-in";

/**
 * Loads `/jobs` and captures the enumerate-tasks POST. It does not select,
 * kill or open stdout: those write remote state or depend on the account's
 * churning job history.
 */
export const drive: JourneyDriver = async (page, env) => {
  await signIn(page, env);

  await page.goto(`${env.baseURL}/jobs`);
  await page
    .getByRole("heading", { level: 1, name: /^jobs$/i })
    .waitFor({ state: "visible", timeout: 30_000 });

  // Rows or the empty state are both valid captures of the enumerate response.
  await page.waitForFunction(
    () => {
      const rows = document.querySelectorAll("tbody tr");
      const text = document.body.textContent.toLowerCase();
      return rows.length > 0 || text.includes("no jobs");
    },
    null,
    { timeout: 30_000 },
  );
  await page.waitForLoadState("networkidle", { timeout: 30_000 });
};
