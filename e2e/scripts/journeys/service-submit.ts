import type { JourneyDriver } from "../record-har";
import { signIn } from "./_helpers/sign-in";

/**
 * Sign in and navigate to the genome-assembly service form (the highest-
 * complexity submission surface in the app). Waits for the form to fully
 * render so any session / profile / service-metadata fetches it triggers on
 * mount land in the HAR.
 *
 * ## What this driver does NOT do
 *
 * It does NOT click submit. The submission path calls
 * `AppService.start_app2` which creates a real, billable job under the test
 * account on every run — capturing that response shape automatically on a
 * cron is the wrong tradeoff. The submit response shape is small, stable,
 * and already covered by hand-rolled overrides in
 * `service-submit.spec.ts`; the form-load surface (this HAR) is the part
 * that actually drifts and benefits from periodic re-recording.
 *
 * If we ever need a real submission HAR, add a separate
 * `service-submit-full` driver behind a manual `workflow_dispatch` job and
 * commit job-cleanup tooling alongside it.
 */
export const drive: JourneyDriver = async (page, env) => {
  await signIn(page, env);

  await page.goto(`${env.baseURL}/services/genome-assembly`);
  // The service header renders an h1 with the service name. Use it as the
  // hydration signal — the form fields below stream in just after.
  await page
    .getByRole("heading", { level: 1, name: /genome assembly/i })
    .waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 });
};
