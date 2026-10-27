import { applyBackendMocks, expect, test } from "../mocks/backends";
import {
  e2eHomePath,
  emptyBackendFallbackOverrides,
  journeyOverrides,
  outagePassthroughOverrides,
  outageRecords,
  signInDuringOutage,
  workspacePopulatedOverrides,
} from "../fixtures/overrides";
import {
  GenomeMemberPage,
  JobsListPage,
  SearchResultsPage,
  TaxonPage,
  WorkspacePage,
} from "../pages";

// The BV-BRC backends as they behaved during the 2026-10-19 maintenance window:
// an immediate 503 with an HTML maintenance page, or a connection that never
// answers. The loopback mock serves both (src/app/api/e2e-mock/[...path]/
// outage.ts) for the requests a test marks, so these assert the whole server
// path: the upstream call, its mapping to a status and a readable message, and
// the page that shows it. How a test marks its requests:
// src/lib/e2e-fixtures/outages.ts.

/** What a page keeps of the maintenance page: its title, never its markup. */
const maintenanceText = "Site Maintenance";

test.describe("data service outage", () => {
  // Record pages read the Data API without a token in e2e, so they run signed
  // out and name an outage record instead.
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...outagePassthroughOverrides.search,
        ...emptyBackendFallbackOverrides,
      ],
    });
  });

  test("a genome page keeps its shell and retries in place", async ({
    page,
  }) => {
    const { genomeId } = outageRecords.maintenance;
    const genome = new GenomeMemberPage(page);
    await genome.goto(genomeId);

    const unavailable = genome.unavailable(genomeId);
    await expect(unavailable.root).toBeVisible();
    await expect(unavailable.root).toContainText(maintenanceText);
    await expect(unavailable.root).not.toContainText("</");
    await expect(genome.heading).toHaveText(`Genome ${genomeId}`);
    await expect(
      unavailable.root.getByRole("link", { name: "Browse genomes" }),
    ).toBeVisible();

    // Retry re-runs the page's server components; the outage is still on, so
    // the same error comes back rather than an empty page.
    const refreshed = page.waitForRequest(
      (request) =>
        request.headers().rsc === "1" &&
        new URL(request.url()).pathname === `/genome/${genomeId}`,
    );
    await unavailable.retryButton.click();
    await refreshed;
    await expect(unavailable.retryButton).toHaveText("Retry");
    await expect(unavailable.root).toContainText(maintenanceText);
  });

  test("a genome page whose lookup never answers says the service did not respond", async ({
    page,
  }) => {
    // The loopback never answers; E2E_UPSTREAM_BUDGET_MS (.env.e2e.test) ends
    // the wait after 5 s, while the message names the production budget.
    test.slow();
    const { genomeId } = outageRecords.hang;
    const genome = new GenomeMemberPage(page);
    await genome.goto(genomeId);

    const unavailable = genome.unavailable(genomeId);
    await expect(unavailable.root).toBeVisible();
    await expect(unavailable.root).toContainText(
      /did not respond \(timed out after 20 s\)/,
    );
    await expect(unavailable.retryButton).toBeVisible();
  });

  test("a taxon page keeps its shell and offers Retry", async ({ page }) => {
    const { taxonId } = outageRecords.maintenance;
    const taxon = new TaxonPage(page);
    await taxon.goto(taxonId);

    const unavailable = taxon.unavailable(taxonId);
    await expect(unavailable.root).toBeVisible();
    await expect(unavailable.root).toContainText(maintenanceText);
    await expect(unavailable.root).not.toContainText("</");
    await expect(unavailable.retryButton).toBeVisible();
    await expect(
      unavailable.root.getByRole("link", { name: "Browse taxa" }),
    ).toBeVisible();
  });

  test("a search says the results could not be loaded and retries", async ({
    page,
  }) => {
    const search = new SearchResultsPage(page);
    const firstSearch = page.waitForResponse("**/api/data/search");
    await search.goto(outageRecords.maintenance.keyword);
    expect((await firstSearch).status()).toBe(503);

    await expect(search.loadError.root).toBeVisible();
    await expect(search.loadError.root).toContainText(maintenanceText);
    await expect(search.loadError.root).not.toContainText("</");

    const retried = page.waitForResponse("**/api/data/search");
    await search.loadError.retryButton.click();
    expect((await retried).status()).toBe(503);
    await expect(search.loadError.retryButton).toHaveText("Retry");
    await expect(search.loadError.root).toBeVisible();
  });
});

test.describe("workspace service outage", () => {
  test.beforeEach(async ({ page, context, baseURL }) => {
    await signInDuringOutage(context, baseURL, { workspace: "maintenance" });
    await applyBackendMocks(page, {
      overrides: [...outagePassthroughOverrides.workspace, ...journeyOverrides],
    });
  });

  test("the home folder says it could not be loaded", async ({ page }) => {
    const workspace = new WorkspacePage(page);
    await page.goto(`/workspace${e2eHomePath}`);

    const loadError = workspace.loadError("Couldn't load your home folder");
    await expect(loadError.root).toBeVisible();
    await expect(loadError.root).toContainText(maintenanceText);
    await expect(loadError.root).not.toContainText("</");
    await expect(loadError.retryButton).toBeVisible();
    await expect(workspace.notFoundDialog).toBeHidden();
  });

  test("a nested folder is not reported missing during an outage", async ({
    page,
  }) => {
    const workspace = new WorkspacePage(page);
    await page.goto(`/workspace${e2eHomePath}/assemblies/2026`);

    const loadError = workspace.loadError("Couldn't load this folder");
    await expect(loadError.root).toBeVisible();
    await expect(loadError.root).toContainText(maintenanceText);
    await expect(loadError.retryButton).toBeVisible();
    await expect(workspace.notFoundDialog).toBeHidden();
  });
});

test.describe("job service outage", () => {
  test.beforeEach(async ({ page, context, baseURL }) => {
    await signInDuringOutage(context, baseURL, { "app-service": "maintenance" });
    await applyBackendMocks(page, {
      overrides: [
        ...outagePassthroughOverrides.jobs,
        // The workspace sidebar's favorites lookup on /jobs.
        ...workspacePopulatedOverrides,
        ...journeyOverrides,
      ],
    });
  });

  test("the jobs page and the header's job pill both say so", async ({
    page,
  }) => {
    const jobs = new JobsListPage(page);
    await jobs.goto();

    await expect(jobs.loadError.root).toBeVisible();
    await expect(jobs.loadError.root).toContainText(maintenanceText);
    await expect(jobs.loadError.root).not.toContainText("</");
    await expect(jobs.loadError.retryButton).toBeVisible();
    await expect(jobs.statusPillUnavailable).toBeVisible();
    await expect(jobs.statusPillUnavailable).toHaveAttribute(
      "title",
      new RegExp(`^Job status unavailable: .*${maintenanceText}`),
    );
  });
});
