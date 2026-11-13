import { test, expect, applyBackendMocks } from "../../mocks/backends";
import {
  authSessionOverrides,
  buildJobsOverrides,
  buildWorkspaceOverrides,
  journeyOverrides,
  mockLifecycleJobs,
} from "../../fixtures/overrides";
import { JobsListPage, Navbar, ServiceFormPage } from "../../pages";
import { harOverridesFor } from "../../scripts/har-overrides";

test.describe("genome assembly submission", () => {
  /**
   * Pre-fills the form via the rerun mechanism (`useRerunForm` reads a sessionStorage
   * blob keyed by `?rerun_key=`) because driving WorkspaceObjectSelector's async
   * dropdown is flaky headless.
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
      owner: "e2e-test-user",
      parameters: {},
    };
    await applyBackendMocks(page, {
      overrides: [
        ...buildWorkspaceOverrides(),
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

    // The output-name input reflecting the rerun value proves `useRerunForm` has
    // applied, including paired_end_libs.
    await expect(page.getByPlaceholder(/select output name/i)).toHaveValue("assembly-e2e");
    // Assemble enables only once canSubmit flips, which needs at least one library.
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
    const pairedLibs = payload.app_params?.paired_end_libs as
      | { read1?: string; read2?: string }[]
      | undefined;
    expect(Array.isArray(pairedLibs)).toBe(true);
    expect(pairedLibs?.[0]).toMatchObject({
      read1: "/e2e-test-user@patricbrc.org/home/sample_R1.fq",
      read2: "/e2e-test-user@patricbrc.org/home/sample_R2.fq",
    });

    await page.getByRole("button", { name: "View Job", exact: true }).click();
    await expect(page).toHaveURL(/\/jobs(?:\?|$|\/)/);
    const jobs = new JobsListPage(page);
    await jobs.waitForRows();
    await expect(jobs.rowById(submittedJob.id)).toBeVisible();
  });

  test("the header job pill shows a just-submitted job within seconds, not after the idle interval", async ({
    page,
  }) => {
    const submittedJob = {
      id: "job-new-assembly",
      app: "GenomeAssembly2",
      status: "queued" as const,
      submit_time: "2026-04-24T12:00:00Z",
      owner: "e2e-test-user",
      parameters: {},
    };
    // The summary has no active jobs until the submit request is seen, and the
    // first answer after it is still the stale one: that is the refetch the
    // submit's invalidation triggers. Only a later answer carries the job, so
    // the post-submit poll window (3 s) is what is under test. Counters, not
    // timers, drive the flip.
    let submitted = false;
    let answersAfterSubmit = 0;
    const summaryCounts = () => {
      if (!submitted) return {};
      answersAfterSubmit += 1;
      return answersAfterSubmit >= 2 ? { queued: 1 } : {};
    };
    await applyBackendMocks(page, {
      overrides: [
        {
          url: /\/api\/services\/app-service\/submit$/,
          method: "POST",
          body: () => {
            submitted = true;
            return { job: [submittedJob] };
          },
        },
        {
          url: /\/api\/services\/app-service\/jobs\/task-summary$/,
          method: "POST",
          body: () => ({ summary: summaryCounts() }),
        },
        {
          url: /\/api\/services\/app-service\/jobs\/summary$/,
          method: "POST",
          body: () => ({ taskSummary: {}, appSummary: {} }),
        },
        ...buildWorkspaceOverrides(),
        ...buildJobsOverrides({ jobs: [] }),
        ...journeyOverrides,
      ],
    });

    await preFillRerunData(page);
    const emptyAnswer = page.waitForResponse((res) =>
      /\/jobs\/task-summary$/.test(res.url()),
    );
    const form = new ServiceFormPage(page, /genome assembly/i);
    await form.goto("/services/genome-assembly?rerun_key=e2e-rerun");
    await expect(page.getByRole("button", { name: /assemble/i })).toBeEnabled();

    const pill = new Navbar(page).jobStatusPill();
    // One empty answer must have landed, or "no pill" proves nothing.
    await emptyAnswer;
    await expect(pill).toHaveCount(0);

    await form.submit(/assemble/i);

    // Well under the 30 s idle interval; the 3 s poll window shows the job.
    await expect(pill).toBeVisible({ timeout: 10_000 });
    await expect(pill).toHaveAccessibleName(/^1 queued\b.*view job status/i);
  });

  test("number inputs preserve keyboard, focus, limit, and button behavior without runtime errors", async ({
    page,
  }) => {
    const runtimeErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));

    await applyBackendMocks(page, {
      overrides: [
        ...buildWorkspaceOverrides(),
        ...buildJobsOverrides(),
        ...journeyOverrides,
      ],
    });
    const form = new ServiceFormPage(page, /genome assembly/i);
    await form.goto("/services/genome-assembly");
    await page.getByRole("button", { name: "Advanced Options" }).click();

    const coverageGroup = page
      .getByText("Target Genome Coverage", { exact: true })
      .locator("..");
    const iterationGroup = page
      .getByText("Racon Iterations", { exact: true })
      .locator("..");
    const coverage = coverageGroup.getByRole("textbox");
    const iterations = iterationGroup.getByRole("textbox");
    await expect(coverage).toHaveValue("200");
    await expect(iterations).toHaveValue("2");

    await coverage.focus();
    await page.keyboard.press("ArrowUp");
    await expect(coverage).toHaveValue("250");
    await expect(iterations).toHaveValue("2");

    await iterations.focus();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await expect(iterations).toHaveValue("4");

    const increase = iterationGroup.getByRole("button", {
      name: "Increase value",
    });
    const decrease = iterationGroup.getByRole("button", {
      name: "Decrease value",
    });
    await expect(increase).toBeDisabled();
    await decrease.click();
    await expect(iterations).toHaveValue("3");
    await expect(increase).toBeEnabled();

    expect(runtimeErrors).toEqual([]);
  });

  test("renders the form heading", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...buildWorkspaceOverrides(),
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

// Replays service-submit.har; the submission POST is not recorded (a real submit would
// create a billable job).
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
