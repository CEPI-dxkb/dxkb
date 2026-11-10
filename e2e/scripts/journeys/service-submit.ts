import type { JourneyDriver } from "../record-har";
import { signIn } from "./_helpers/sign-in";

/**
 * Loads the genome-assembly form so its session, profile and service-metadata
 * fetches land in the HAR. It never clicks submit: `AppService.start_app2`
 * creates a real billable job.
 */
export const drive: JourneyDriver = async (page, env) => {
  await signIn(page, env);

  await page.goto(`${env.baseURL}/services/genome-assembly`);
  // The h1 is the hydration signal; the form fields stream in just after.
  await page
    .getByRole("heading", { level: 1, name: /genome assembly/i })
    .waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 });
};
