import { test, expect, applyBackendMocks } from "../mocks/backends";
import {
  journeyOverrides,
  workspacePopulatedOverrides,
} from "../fixtures/overrides";
import { JobsListPage, WorkspacePage } from "../pages";

test.describe("jobs page", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        // Workspace.get (favorites) fired when /jobs page loads the workspace sidebar chrome.
        ...workspacePopulatedOverrides,
        ...journeyOverrides,
      ],
    });
  });

  test("renders the Jobs heading for signed-in user", async ({ page }) => {
    await page.goto("/jobs");
    await expect(page).not.toHaveURL(/sign-in/);
    await expect(page.getByRole("heading", { level: 1, name: /^jobs$/i })).toBeVisible();
  });

  test("shows job status pill in navbar for signed-in user with jobs", async ({ page }) => {
    await page.goto("/jobs");
    // journeyOverrides includes jobsOverrides which mocks the summary endpoint with
    // 1 completed + 1 running job, so displayableCount > 0 and the pill should render.
    const pill = page.getByRole("button", { name: /view job status/i });
    await expect(pill).toBeVisible();
  });

  test("job status pill opens popover with job list on click", async ({ page }) => {
    await page.goto("/jobs");
    const pill = page.getByRole("button", { name: /view job status/i });
    await expect(pill).toBeVisible();
    await pill.click();
    await expect(page.getByText("My Jobs")).toBeVisible();
    await expect(page.getByText("View all →")).toBeVisible();
  });

  test("a status filter and a search survive leaving the page, Back, and a refresh", async ({
    page,
  }) => {
    const jobs = new JobsListPage(page);
    await jobs.goto();
    await jobs.waitForJob("job-001");

    // "assembly" matches job-001's service (GenomeAssembly), the one completed job.
    await jobs.filterByStatus("Completed");
    await jobs.search("assembly");
    // `q` is written after the search box's 300 ms debounce.
    await jobs.expectUrlParams({ status: "completed", q: "assembly" });

    const expectFiltersRestored = async () => {
      await jobs.expectUrlParams({ status: "completed", q: "assembly" });
      await jobs.expectStatus("Completed");
      await jobs.expectSearch("assembly");
      await expect(jobs.rowById("job-001")).toBeVisible();
    };

    // The mocked job has no output path, so there is no row to open. The navbar's
    // Workspace menu reaches the same folder through the client router, which makes
    // the Back below a Next popstate (a `page.goto` away would make it a document load).
    await jobs.openWorkspaceHomeFromNavbar();
    const workspace = new WorkspacePage(page);
    await expect(page).toHaveURL(/\/workspace\/e2e-test-user@patricbrc\.org\/home$/);
    await expect(workspace.breadcrumbs).toBeVisible();
    await page.goBack();
    await expect(jobs.heading).toBeVisible();
    await expectFiltersRestored();

    await page.reload();
    await expect(jobs.heading).toBeVisible();
    await expectFiltersRestored();
  });

  test("a date range from the URL shows in the date filter", async ({ page }) => {
    const jobs = new JobsListPage(page);
    await jobs.goto("?from=2026-09-01&to=2026-09-10");

    await jobs.expectDateFilter("Between Sep 1, 2026 → Sep 10, 2026");
  });

  test("Back steps through discrete changes one at a time", async ({ page }) => {
    const jobs = new JobsListPage(page);
    await jobs.goto();
    await jobs.waitForJob("job-001");

    // Entry A: a status change.
    await jobs.filterByStatus("Completed");
    await jobs.expectUrlParams({ status: "completed", sort: null });
    // Entry B: a sort change on top of it. The list starts sorted by Submit, newest first.
    await jobs.sortBy("Start");
    await jobs.expectUrlParams({ status: "completed", sort: "start_time:asc" });
    await jobs.expectSort("Start", "ascending");
    await jobs.expectSort("Submit", "none");

    await page.goBack();
    await jobs.expectUrlParams({ status: "completed", sort: null });
    await jobs.expectStatus("Completed");
    await jobs.expectSort("Start", "none");
    await jobs.expectSort("Submit", "descending");

    await page.goBack();
    await expect(page).toHaveURL(/\/jobs$/);
    await jobs.expectStatus("All Status");
  });

  test("a search is its own Back step after a filter change", async ({ page }) => {
    const jobs = new JobsListPage(page);
    await jobs.goto();
    await jobs.waitForJob("job-001");

    await jobs.filterByStatus("Completed");
    await jobs.expectUrlParams({ status: "completed", q: null });
    // Two debounced commits of one search share an entry on top of the status one.
    await jobs.search("assem");
    await jobs.expectUrlParams({ status: "completed", q: "assem" });
    await jobs.search("assembly");
    await jobs.expectUrlParams({ status: "completed", q: "assembly" });

    await page.goBack();
    await jobs.expectUrlParams({ status: "completed", q: null });
    await jobs.expectStatus("Completed");
    await jobs.expectSearch("");

    await page.goBack();
    await expect(page).toHaveURL(/\/jobs$/);
    await jobs.expectStatus("All Status");
  });
});
