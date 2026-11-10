import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  authSessionOverrides,
  buildJobsOverrides,
  jobsListOverrides,
  journeyOverrides,
  mockLifecycleJobs,
  workspacePopulatedOverrides,
} from "../fixtures/overrides";
import { JobsListPage } from "../pages";
import { harOverridesFor } from "../scripts/har-overrides";

test.describe("jobs lifecycle", () => {
  test("list renders all three mocked jobs", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...workspacePopulatedOverrides,
        ...jobsListOverrides,
        ...journeyOverrides,
      ],
    });
    const jobs = new JobsListPage(page);
    await jobs.goto();
    await jobs.waitForRows();

    for (const job of mockLifecycleJobs) {
      await expect(jobs.rowById(job.id)).toBeVisible();
    }
  });

  test("normalizes a numeric job id across search, selection, output, and kill", async ({ page }) => {
    const numericJob = {
      id: 12345,
      app: "GenomeAssembly2",
      status: "running",
      submit_time: "2026-04-20T07:50:00Z",
      start_time: "2026-04-20T07:55:00Z",
      owner: "e2e-test-user",
      parameters: {},
    };
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    await applyBackendMocks(page, {
      overrides: [
        ...workspacePopulatedOverrides,
        ...jobsListOverrides,
        ...journeyOverrides,
      ],
    });
    await page.route(
      "**/api/services/app-service/jobs/enumerate-tasks-filtered",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ jobs: [numericJob], totalTasks: 1 }),
        });
      },
    );
    await page.route("**/api/services/app-service/jobs/12345/stdout", async (route) => {
      await route.fulfill({ status: 200, body: "numeric job output" });
    });
    await page.route("**/api/services/app-service/jobs/12345/kill", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "Kill request accepted" }),
      });
    });

    const jobs = new JobsListPage(page);
    await jobs.goto();
    await jobs.waitForRows();
    await expect(jobs.rowById("12345")).toBeVisible();

    await jobs.searchInput.fill("12345");
    await expect(jobs.rowById("12345")).toBeVisible();
    await jobs.selectJob("12345");
    await expect(page.getByRole("heading", { level: 3, name: "12345" })).toBeVisible();

    const stdoutRequest = page.waitForRequest(
      (request) => request.url().endsWith("/jobs/12345/stdout"),
    );
    await page.getByRole("button", { name: /^standard output$/i }).click();
    await stdoutRequest;
    await expect(page.getByText("numeric job output")).toBeVisible();

    const killRequest = page.waitForRequest(
      (request) =>
        request.url().endsWith("/jobs/12345/kill") && request.method() === "POST",
    );
    await jobs.killSelected();
    await killRequest;
    await expect(page.getByText(/kill request for job 12345/i)).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test("renders production AppService jobs in the table and navbar", async ({ page }) => {
    const productionJob = {
      id: 22976705,
      app: "PredictStructure",
      application_name: "PredictStructure",
      status: "completed",
      submit_time: "2026-07-08T14:13:10Z",
      start_time: "2026-07-08T14:13:32Z",
      completed_time: "2026-07-08T14:15:02Z",
      elapsed_time: "00:01:30",
      user_id: "e2e-test-user@bvbrc",
      parameters: { output_file: "production-shaped-output" },
      parent_id: null,
      workspace: null,
      storage_location: "",
    };

    await applyBackendMocks(page, {
      overrides: [
        ...workspacePopulatedOverrides,
        {
          url: /\/api\/services\/app-service\/jobs\/enumerate-tasks-filtered$/,
          method: "POST",
          body: { jobs: [productionJob], totalTasks: 1 },
        },
        ...jobsListOverrides,
        ...journeyOverrides,
      ],
    });

    const jobs = new JobsListPage(page);
    await jobs.goto();
    await jobs.waitForRows();

    await expect(page.getByText(/error loading jobs/i)).not.toBeVisible();
    await expect(jobs.rowById("22976705")).toContainText("production-shaped-output");

    await page.getByRole("button", { name: /view job status/i }).click();
    const jobPopover = page.getByRole("dialog", { name: /my jobs/i });
    await expect(jobPopover.getByText("Predict Structure")).toBeVisible();
    await expect(jobPopover.getByText("production-shaped-output")).toBeVisible();
  });

  test("shows a response contract error instead of silently hiding malformed jobs", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...workspacePopulatedOverrides,
        ...jobsListOverrides,
        ...journeyOverrides,
      ],
    });
    await page.route(
      "**/api/services/app-service/jobs/enumerate-tasks-filtered",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jobs: [{ id: null, app: "GenomeAssembly2", status: "running" }],
            totalTasks: 1,
          }),
        });
      },
    );

    const jobs = new JobsListPage(page);
    await jobs.goto();

    const loadError = page
      .getByRole("alert")
      .filter({ hasText: /could not load jobs/i });
    await expect(loadError).toBeVisible();
    await expect(loadError).toContainText(/invalid jobs response/i);
    await expect(jobs.rowById("null")).not.toBeVisible();
  });

  test("filtering by status narrows the rows", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...workspacePopulatedOverrides,
        ...jobsListOverrides,
        ...journeyOverrides,
      ],
    });
    const jobs = new JobsListPage(page);
    await jobs.goto();
    await jobs.waitForRows();

    await jobs.filterByStatus(/^running$/i);

    await expect(jobs.rowById("job-running")).toBeVisible();
    await expect(jobs.rowById("job-queued")).not.toBeVisible();
    await expect(jobs.rowById("job-completed")).not.toBeVisible();
  });

  test("selecting a running job surfaces the details panel with its id", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...workspacePopulatedOverrides,
        ...jobsListOverrides,
        ...journeyOverrides,
      ],
    });
    const jobs = new JobsListPage(page);
    await jobs.goto();
    await jobs.waitForRows();

    await jobs.selectJob("job-running");

    // Use the panel's <h3>; the same id also appears in the table cell.
    await expect(page.getByRole("heading", { level: 3, name: "job-running" })).toBeVisible();
  });

  test("expanding Standard Output fetches and renders stdout content", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...workspacePopulatedOverrides,
        ...buildJobsOverrides({
          jobs: mockLifecycleJobs,
          stdoutById: {
            "job-running": "Running step 1\nRunning step 2\n",
          },
        }),
        ...journeyOverrides,
      ],
    });
    const jobs = new JobsListPage(page);
    await jobs.goto();
    await jobs.waitForRows();
    await jobs.selectJob("job-running");

    const stdoutRequest = page.waitForRequest(
      (req) =>
        req.url().endsWith("/api/services/app-service/jobs/job-running/stdout") &&
        req.method() === "GET",
    );
    await page.getByRole("button", { name: /^standard output$/i }).click();
    await stdoutRequest;

    await expect(page.getByText("Running step 1")).toBeVisible();
  });

  test("KILL transitions the running job to a terminal status in the list", async ({ page }) => {
    // Stateful kill flow: after the kill POST, /enumerate-tasks-filtered and the
    // per-job GET flip job-running to "cancelled" (statusConfig has no "killed").
    let killed = false;
    const buildJobs = () =>
      mockLifecycleJobs.map((j) =>
        j.id === "job-running" && killed ? { ...j, status: "cancelled" as const } : j,
      );

    await applyBackendMocks(page, {
      overrides: [
        ...workspacePopulatedOverrides,
        ...jobsListOverrides,
        ...journeyOverrides,
      ],
    });

    // Registered after applyBackendMocks, so they are matched first (LIFO).
    await page.route("**/api/services/app-service/jobs/job-running/kill", async (route) => {
      killed = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "Kill request accepted" }),
      });
    });
    await page.route("**/api/services/app-service/jobs/enumerate-tasks-filtered", async (route) => {
      const list = buildJobs();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jobs: list, totalTasks: list.length }),
      });
    });
    await page.route(/\/api\/services\/app-service\/jobs\/job-running(?:\?|$)/, async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      const list = buildJobs();
      const updated = list.find((j) => j.id === "job-running");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(updated),
      });
    });

    const jobs = new JobsListPage(page);
    await jobs.goto();
    await jobs.waitForRows();
    await jobs.selectJob("job-running");

    const killRequest = page.waitForRequest(
      (req) =>
        req.url().endsWith("/api/services/app-service/jobs/job-running/kill") &&
        req.method() === "POST",
    );
    await jobs.killSelected();
    await killRequest;

    await expect(page.getByText(/kill request for job job-running/i)).toBeVisible();
    await expect(jobs.rowById("job-running")).toContainText(/cancelled/i);
  });

  test("polling refreshes the running job's status when the backend transitions it", async ({ page }) => {
    // The list polls every 10s while a job is active; flip job-running to "completed"
    // on the second enumerate call.
    let enumerateCalls = 0;
    await applyBackendMocks(page, {
      overrides: [
        ...workspacePopulatedOverrides,
        ...buildJobsOverrides({ jobs: mockLifecycleJobs }),
        ...journeyOverrides,
      ],
    });
    await page.route(
      "**/api/services/app-service/jobs/enumerate-tasks-filtered",
      async (route) => {
        enumerateCalls += 1;
        const list = mockLifecycleJobs.map((j) =>
          j.id === "job-running" && enumerateCalls > 1
            ? { ...j, status: "completed" as const }
            : j,
        );
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ jobs: list, totalTasks: list.length }),
        });
      },
    );

    const jobs = new JobsListPage(page);
    await jobs.goto();
    await jobs.waitForRows();
    await jobs.selectJob("job-running");

    const statusBadge = page
      .locator("h3", { hasText: "job-running" })
      .locator("xpath=following-sibling::span");
    await expect(statusBadge).toContainText(/running/i);
    // Refetch interval is 10s with active jobs; leave headroom for slow CI.
    await expect(statusBadge).toContainText(/completed/i, { timeout: 20_000 });
    expect(enumerateCalls).toBeGreaterThanOrEqual(2);
  });
});

// Replays jobs-lifecycle.har; the recorded account has no jobs, so the payload is
// empty.
test.describe("jobs lifecycle via recorded HAR replay", () => {
  test("renders the recorded empty jobs state", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        // The header job pill polls task-summary, which the recording predates.
        {
          url: /\/api\/services\/app-service\/jobs\/task-summary$/,
          method: "POST",
          body: { summary: [{}] },
        },
        ...harOverridesFor("jobs-lifecycle.har"),
      ],
    });

    const jobs = new JobsListPage(page);
    await jobs.goto();

    await expect(page.getByRole("heading", { level: 1, name: /^jobs$/i })).toBeVisible();
    await expect(page.getByText(/no jobs found/i).first()).toBeVisible();
  });
});
