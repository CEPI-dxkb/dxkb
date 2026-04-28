import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  authSessionOverrides,
  buildJobsOverrides,
  jobsListOverrides,
  mockLifecycleJobs,
  permissiveBackendOverrides,
  workspacePopulatedOverrides,
} from "../fixtures/overrides";
import { JobsListPage } from "../pages";
import { harOverridesFor } from "../scripts/har-overrides";

test.describe("jobs lifecycle", () => {
  test("list renders all three mocked jobs", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspacePopulatedOverrides,
        ...jobsListOverrides,
        ...permissiveBackendOverrides,
      ],
    });
    const jobs = new JobsListPage(page);
    await jobs.goto();
    await jobs.waitForRows();

    for (const job of mockLifecycleJobs) {
      await expect(jobs.rowById(job.id)).toBeVisible();
    }
  });

  test("filtering by status narrows the rows", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspacePopulatedOverrides,
        ...jobsListOverrides,
        ...permissiveBackendOverrides,
      ],
    });
    const jobs = new JobsListPage(page);
    await jobs.goto();
    await jobs.waitForRows();

    await jobs.filterByStatus(/^running$/i);

    // Only the running job should be visible; the others are filtered out client-side.
    await expect(jobs.rowById("job-running")).toBeVisible();
    await expect(jobs.rowById("job-queued")).not.toBeVisible();
    await expect(jobs.rowById("job-completed")).not.toBeVisible();
  });

  test("selecting a running job surfaces the details panel with its id", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspacePopulatedOverrides,
        ...jobsListOverrides,
        ...permissiveBackendOverrides,
      ],
    });
    const jobs = new JobsListPage(page);
    await jobs.goto();
    await jobs.waitForRows();

    await jobs.selectJob("job-running");

    // The details panel renders the job id in its header. Use the panel's `<h3>` to avoid
    // matching the same id in the table cell.
    await expect(page.getByRole("heading", { level: 3, name: "job-running" })).toBeVisible();
  });

  test("expanding Standard Output fetches and renders stdout content", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspacePopulatedOverrides,
        ...buildJobsOverrides({
          jobs: mockLifecycleJobs,
          stdoutById: {
            "job-running": "Running step 1\nRunning step 2\n",
          },
        }),
        ...permissiveBackendOverrides,
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
    // Stateful kill flow:
    //   1. Until kill is invoked, /enumerate-tasks-filtered and the per-job GET return the
    //      original lifecycle fixture (job-running is "running").
    //   2. After the kill POST fires, both endpoints flip job-running to "cancelled" — this is
    //      the production terminal state the kill action drives the job into (statusConfig has
    //      no "killed"; the mock model uses "cancelled" as the canonical terminal label).
    // The two `useKillJob.onSuccess` invalidations (jobs / jobs-filtered) drive a refetch,
    // and the row transitions in the UI without any extra prompting.
    let killed = false;
    const buildJobs = () =>
      mockLifecycleJobs.map((j) =>
        j.id === "job-running" && killed ? { ...j, status: "cancelled" as const } : j,
      );

    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspacePopulatedOverrides,
        ...jobsListOverrides,
        ...permissiveBackendOverrides,
      ],
    });

    // Register kill-aware routes AFTER applyBackendMocks so they match first (Playwright routes
    // run LIFO). These take over the three endpoints that observe the kill transition; every
    // other route still falls through to the standard jobsListOverrides.
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

    // The toast confirms the kill request reached the server. The row transition that follows
    // proves the invalidations actually re-rendered the list with the new status.
    await expect(page.getByText(/kill request for job job-running/i)).toBeVisible();
    await expect(jobs.rowById("job-running")).toContainText(/cancelled/i);
  });

  test("polling refreshes the running job's status when the backend transitions it", async ({ page }) => {
    // The jobs list polls /enumerate-tasks-filtered every 10s while any active job is present.
    // We flip job-running to "completed" on the second enumerate call to verify the row + the
    // details panel both re-render on a backend transition rather than freezing on the initial
    // fetch. JobDetailsPanel reads `job.status` from the list selection, so the badge update is
    // the observable signal that the list refetch landed.
    let enumerateCalls = 0;
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...workspacePopulatedOverrides,
        ...buildJobsOverrides({ jobs: mockLifecycleJobs }),
        ...permissiveBackendOverrides,
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
    // List refetch interval is 10s when there are active jobs; allow some headroom so the test
    // isn't a coin-flip on a slow CI runner.
    await expect(statusBadge).toContainText(/completed/i, { timeout: 20_000 });
    expect(enumerateCalls).toBeGreaterThanOrEqual(2);
  });
});

// Drives the jobs page against post-auth traffic recorded in
// `jobs-lifecycle.har`. The recorder hit `/jobs` against the live test
// account (which has no submitted jobs), so the recorded
// `enumerate-tasks-filtered` payload is `{jobs:[],totalTasks:0}` — i.e. the
// empty-state path. Asserting on the empty-state copy proves the
// HAR-derived overrides actually fed the jobs hook.
//
// `authSessionOverrides` layers first so the AuthBoundary's hydration
// refresh sees a signed-in user; the auth-shape contract test against
// `auth-sign-in.har` lives in `auth.spec.ts` and isn't duplicated here.
//
// No `permissiveBackendOverrides` here on purpose — this spec is the canary
// that the recorded HAR fully covers the jobs lifecycle. A catch-all would
// silently serve `{result:[[]]}` for any drift in coverage and the test would
// still pass; instead we let the strict guard fail loudly so the missing
// replay surfaces and the HAR can be re-recorded.
test.describe("jobs lifecycle via recorded HAR replay", () => {
  test("renders the recorded empty jobs state", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...authSessionOverrides,
        ...harOverridesFor("jobs-lifecycle.har"),
      ],
    });

    const jobs = new JobsListPage(page);
    await jobs.goto();

    await expect(page.getByRole("heading", { level: 1, name: /^jobs$/i })).toBeVisible();
    await expect(page.getByText(/no jobs found/i).first()).toBeVisible();
  });
});
