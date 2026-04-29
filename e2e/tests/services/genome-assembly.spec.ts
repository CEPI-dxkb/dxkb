import { test, expect, applyBackendMocks } from "../../mocks/backends";
import {
  authSessionOverrides,
  buildJobsOverrides,
  buildWorkspaceOverrides,
  journeyOverrides,
  mockLifecycleJobs,
} from "../../fixtures/overrides";
import { JobsListPage, ServiceFormPage } from "../../pages";
import { harOverridesFor } from "../../scripts/har-overrides";

test.describe("genome assembly submission", () => {
  /**
   * Pre-fill the form via the rerun mechanism instead of driving the WorkspaceObjectSelector.
   * The selector requires typing, waiting on its async search dropdown, and clicking a
   * portal-rendered listbox — all flaky in headless runs. `useRerunForm` reads a sessionStorage
   * blob keyed by `?rerun_key=` on mount and copies the declared fields + libraries onto the
   * form in one shot, which exercises the same `submitFormData` → `app-service/submit` path
   * but keeps the test focused on the payload shape and post-submit jobs flow.
   */
  async function preFillRerunData(page: import("@playwright/test").Page) {
    await page.addInitScript(() => {
      sessionStorage.setItem(
        "e2e-rerun",
        JSON.stringify({
          output_path: "/e2e-test-user@patricbrc.org/home",
          output_file: "assembly-e2e",
          recipe: "unicycler",
          paired_end_libs: [
            {
              read1: "/e2e-test-user@patricbrc.org/home/sample_R1.fq",
              read2: "/e2e-test-user@patricbrc.org/home/sample_R2.fq",
              platform: "illumina",
              interleaved: false,
            },
          ],
        }),
      );
    });
  }

  test("submitting a paired-end assembly POSTs the expected payload and lands the new job in /jobs", async ({ page }) => {
    const submittedJob = {
      id: "job-new-assembly",
      app: "GenomeAssembly2",
      status: "queued" as const,
      submit_time: "2026-04-24T12:00:00Z",
      parameters: {},
    };
    await applyBackendMocks(page, {
      overrides: [
        // buildWorkspaceOverrides covers Workspace.ls / Workspace.get / Workspace.list_permissions
        // for the output-folder selector and the post-submit /jobs workspace sidebar chrome.
        ...buildWorkspaceOverrides(),
        // Include the lifecycle fixture jobs PLUS the freshly-submitted one so the post-submit
        // /jobs view renders the new row alongside the existing list.
        ...buildJobsOverrides({
          jobs: [submittedJob, ...mockLifecycleJobs],
          submitResponse: { job: [submittedJob] },
        }),
        ...journeyOverrides,
      ],
    });

    await preFillRerunData(page);

    const form = new ServiceFormPage(page, /genome assembly/i);
    await form.goto("/services/genome-assembly?rerun_key=e2e-rerun");

    // Wait for the output-name input to reflect the rerun value — proxy for "rerun has been
    // applied," which guarantees `useRerunForm` has run `syncLibraries` on the paired_end_libs
    // payload too. The paired-lib presence is verified more reliably below by inspecting the
    // submit POST body than by scraping the SelectedItemsTable text.
    await expect(page.getByPlaceholder(/select output name/i)).toHaveValue("assembly-e2e");
    // The Assemble button only enables once tanstack-form's `canSubmit` flips to true, which
    // requires the libraries to be present on the form (the schema enforces ≥1 input source).
    await expect(page.getByRole("button", { name: /assemble/i })).toBeEnabled();

    const submitRequest = page.waitForRequest(
      (req) =>
        req.url().endsWith("/api/services/app-service/submit") &&
        req.method() === "POST",
    );
    await form.submit(/assemble/i);

    const req = await submitRequest;
    const payload = req.postDataJSON() as {
      app_name?: string;
      app_params?: Record<string, unknown>;
    };
    expect(payload.app_name).toBe("GenomeAssembly2");
    expect(payload.app_params).toMatchObject({
      output_path: "/e2e-test-user@patricbrc.org/home",
      output_file: "assembly-e2e",
      recipe: "unicycler",
    });
    // The paired-end payload is what 4d cares about — it is the difference between the form
    // round-tripping a real workspace selection and silently dropping the libraries.
    const pairedLibs = payload.app_params?.paired_end_libs as
      | { read1?: string; read2?: string }[]
      | undefined;
    expect(Array.isArray(pairedLibs)).toBe(true);
    expect(pairedLibs?.[0]).toMatchObject({
      read1: "/e2e-test-user@patricbrc.org/home/sample_R1.fq",
      read2: "/e2e-test-user@patricbrc.org/home/sample_R2.fq",
    });

    // The submission success toast surfaces a "View Job" action that pushes /jobs. Click it
    // (instead of asserting an automatic redirect — the app does not auto-navigate) and verify
    // the freshly-submitted job is rendered in the list.
    await page.getByRole("button", { name: /view job/i }).click();
    await expect(page).toHaveURL(/\/jobs(?:\?|$|\/)/);
    const jobs = new JobsListPage(page);
    await jobs.waitForRows();
    await expect(jobs.rowById(submittedJob.id)).toBeVisible();
  });

  test("renders the form heading", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        // buildWorkspaceOverrides covers Workspace.ls / Workspace.get / Workspace.list_permissions
        // used by the output-folder autocomplete and workspace sidebar.
        ...buildWorkspaceOverrides(),
        // buildJobsOverrides covers AppService.enumerate_tasks_filtered for the sidebar job count.
        ...buildJobsOverrides(),
        ...journeyOverrides,
      ],
    });
    const form = new ServiceFormPage(page, /genome assembly/i);
    await form.goto("/services/genome-assembly");
    await expect(form.heading).toBeVisible();
    await expect(page.getByRole("button", { name: /assemble/i })).toBeVisible();
  });
});

// Drives the genome-assembly form-load journey against post-auth traffic
// recorded in `service-submit.har`. The submission POST itself isn't
// recorded — the recorder explicitly avoids it (a real submit would create
// a billable job under the test account; see
// `scripts/journeys/service-submit.ts`). Spec assertions stay scoped to
// what the form renders on mount. See `harOverridesFor` for the canary
// rationale (no `permissiveBackendOverrides` here).
test.describe("genome assembly via recorded HAR replay", () => {
  test("renders the form heading and submit button from recorded form-load traffic", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...harOverridesFor("service-submit.har"),
      ],
    });

    const form = new ServiceFormPage(page, /genome assembly/i);
    await form.goto("/services/genome-assembly");
    await expect(form.heading).toBeVisible();
    await expect(page.getByRole("button", { name: /assemble/i })).toBeVisible();
  });
});
