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

  test("clicking KILL on a running job POSTs the kill endpoint", async ({ page }) => {
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

    const killRequest = page.waitForRequest(
      (req) =>
        req.url().endsWith("/api/services/app-service/jobs/job-running/kill") &&
        req.method() === "POST",
    );
    await jobs.killSelected();
    await killRequest;
  });
});
