import { applyBackendMocks, expect, test } from "../mocks/backends";
import {
  emptyBackendFallbackOverrides,
  genomeFeatureScenarioOverrides,
  genomeScenarioOverrides,
  genomeSequenceScenarioOverrides,
} from "../fixtures/overrides";
import { GenomeMemberPage } from "../pages";

const genomeViewOverrides = [
  ...genomeScenarioOverrides,
  ...genomeFeatureScenarioOverrides,
  ...genomeSequenceScenarioOverrides,
  ...emptyBackendFallbackOverrides,
];

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Genome view", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [...genomeViewOverrides],
    });
  });

  test("uses the shared rich Genome collection in Taxonomy", async ({
    page,
  }) => {
    await page.goto("/taxonomy/11974?tab=genomes");

    const keyword = page.getByPlaceholder("Search keywords...");
    await expect(keyword).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: "Middle East respiratory syndrome-related coronavirus isolate",
      }),
    ).toHaveCount(0);

    await keyword.fill("MERS");
    await expect(page).toHaveURL(/\/taxonomy\/11974\?tab=genomes$/);
    await page.getByRole("button", { name: "Show Filters" }).click();
    const filteredResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === "/api/data/genome" &&
        url.searchParams.get("rql")?.includes("eq(genome_status,Complete)") === true
      );
    });
    await page.getByRole("button", { name: "Complete (1)" }).click();
    await filteredResponse;
    await expect(page).toHaveURL(
      /\/taxonomy\/11974\?tab=genomes&genome_status=Complete$/,
    );

    const row = page.getByRole("row", { name: /Select row 1282460\.2049/ });
    const checkbox = row.getByRole("checkbox", {
      name: "Select row 1282460.2049",
    });
    const detailHeading = page.getByRole("heading", {
      level: 3,
      name: "Middle East respiratory syndrome-related coronavirus isolate",
    });
    await expect(row).toBeVisible();
    await expect(async () => {
      await checkbox.check();
      await expect(detailHeading).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
    await expect(
      page.getByRole("button", { name: /^G\s*GENOME$/i }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "General Info" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Genome Statistics" }),
    ).toBeVisible();

  });

  test("uses URL keywords for full-dataset search in canonical collections", async ({ page }) => {
    const genomeRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return url.pathname === "/api/data/genome" && url.searchParams.get("keyword") === "MERS";
    });
    await page.goto("/genome?keyword=MERS");
    await genomeRequest;
    await expect(page.getByRole("banner").getByRole("combobox", { name: "Search type" })).toContainText("Genomes");
    await expect(page.getByRole("banner").getByRole("textbox")).toHaveValue("MERS");
    const genomeFilter = page.getByPlaceholder("Search keywords...");
    await expect(genomeFilter).toHaveValue("");
    await expect(page.getByRole("row", { name: /Select row 1282460\.2049/ })).toBeVisible();

    const genomeRefinementRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === "/api/data/genome" &&
        url.searchParams.get("keyword") === "MERS" &&
        url.searchParams.get("rql")?.includes("keyword(coronavirus)") === true
      );
    });
    await genomeFilter.fill("coronavirus");
    await genomeRefinementRequest;
    await expect(page).toHaveURL("/genome?keyword=MERS&refine=coronavirus");

    const featureRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return url.pathname === "/api/data/genome_feature" && url.searchParams.get("keyword") === "replicase";
    });
    await page.goto("/feature?keyword=replicase");
    await featureRequest;
    await expect(page.getByRole("banner").getByRole("combobox", { name: "Search type" })).toContainText("Features");
    await expect(page.getByRole("banner").getByRole("textbox")).toHaveValue("replicase");
    const featureFilter = page.getByPlaceholder("Search keywords...");
    await expect(featureFilter).toHaveValue("");
    await expect(page.getByRole("row", { name: /replicase polyprotein/ })).toBeVisible();

    const featureRefinementRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === "/api/data/genome_feature" &&
        url.searchParams.get("keyword") === "replicase" &&
        url.searchParams.get("rql")?.includes("keyword(polyprotein)") === true
      );
    });
    await featureFilter.fill("polyprotein");
    await featureRefinementRequest;
    await expect(page).toHaveURL(
      "/feature?keyword=replicase&refine=polyprotein",
    );
  });

  test("canonicalizes invalid collection position without rendering an error", async ({
    page,
  }) => {
    await page.goto("/genome?page=0&sort=unknown%3Aasc&keep=yes");

    await expect(page).toHaveURL(/\/genome\?keep=yes$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Genomes" }),
    ).toBeVisible();
  });

  test("searches, inspects, opens, and returns to the same collection", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("combobox", { name: "Search type" }).click();
    await page.getByRole("option", { name: "Genomes" }).click();
    await page
      .getByPlaceholder("Search by virus name, protein, gene, or taxonomy...")
      .fill("MERS");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    await expect(page).toHaveURL(/\/genome\?keyword=MERS$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Genomes" }),
    ).toBeVisible();
    await expect(page.getByRole("banner").getByRole("textbox")).toHaveValue(
      "MERS",
    );
    await expect(page.getByPlaceholder("Search keywords...")).toHaveValue("");

    const row = page.getByRole("row", { name: /Select row 1282460\.2049/ });
    await row.click();
    await expect(
      page.getByRole("heading", {
        level: 3,
        name: "Middle East respiratory syndrome-related coronavirus isolate",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Genome Statistics" }),
    ).toBeVisible();

    const genomePage = await Promise.all([
      page.context().waitForEvent("page"),
      page.getByRole("button", { name: /^G\s*GENOME$/i }).click(),
    ]).then(([opened]) => opened);
    await applyBackendMocks(genomePage, {
      overrides: [...genomeViewOverrides],
    });

    await expect(genomePage).toHaveURL(/\/genome\/1282460\.2049$/);
    await expect(
      genomePage.getByRole("heading", {
        level: 1,
        name: "Middle East respiratory syndrome-related coronavirus isolate",
      }),
    ).toBeVisible();
    await expect(genomePage.getByText("Assembly summary").first()).toBeVisible();
    const sequenceRequest = genomePage.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === "/api/data/genome_sequence" &&
        url.searchParams.get("rql") === "eq(genome_id,1282460.2049)"
      );
    });
    await genomePage.getByRole("button", { name: "Sequences" }).click();
    await sequenceRequest;
    await expect(genomePage).toHaveURL(/\?tab=sequences$/);
    await expect(genomePage.getByText("JX869059")).toBeVisible();
    await expect(
      genomePage.getByRole("button", { name: "Genome Browser" }),
    ).toHaveAttribute("aria-disabled", "true");

    await genomePage.goBack();
    await expect(genomePage).toHaveURL(/\/genome\/1282460\.2049$/);
    await genomePage.close();
    await expect(page).toHaveURL(/\/genome\?keyword=MERS$/);
    await expect(page.getByRole("banner").getByRole("textbox")).toHaveValue(
      "MERS",
    );
    await expect(page.getByPlaceholder("Search keywords...")).toHaveValue("");
  });

  test("a nested table keeps its sort across a refresh, one Back step undoes it, and a tab switch clears it", async ({
    page,
  }) => {
    const genome = new GenomeMemberPage(page);
    // The overview is the entry that a second Back must reach. Features is then opened
    // by URL: its rows load client-side, which proves hydration before any tab click.
    await genome.goto("1282460.2049");
    await genome.goto("1282460.2049", "features");
    await genome.expectRow(/replicase polyprotein/);
    await genome.expectUrlParams({ tab: "features", "features.sort": null });
    // The fixture has one page of features, so this exercises the sort. The table
    // starts sorted by BRC ID (patric_id), ascending.
    await genome.expectSort("BRC ID", "ascending");

    const entriesBeforeSort = await genome.historyLength();
    await genome.sortBy("Product");
    await genome.expectUrlParams({
      tab: "features",
      "features.sort": "product:asc",
    });
    await genome.expectSort("Product", "ascending");
    await genome.expectSort("BRC ID", "none");
    // A sort click also resets the page, which used to add a second entry.
    await expect
      .poll(() => genome.historyLength())
      .toBe(entriesBeforeSort + 1);

    await page.reload();
    await genome.expectUrlParams({
      tab: "features",
      "features.sort": "product:asc",
    });
    await genome.expectSort("Product", "ascending");
    await genome.expectSort("BRC ID", "none");

    // One Back undoes the sort and lands on the features tab as it was before the click.
    await page.goBack();
    await genome.expectUrlParams({ tab: "features", "features.sort": null });
    await expect(page).toHaveURL(/\/genome\/1282460\.2049\?tab=features$/);
    await genome.expectSort("BRC ID", "ascending");
    // The reload orphaned the older entries, so each step below loads a fresh document.
    await genome.expectRow(/replicase polyprotein/);
    await genome.settle();
    // A second Back leaves the tab. A leftover duplicate entry would stop on the
    // features URL again instead of reaching the overview.
    await page.goBack();
    await expect(page).toHaveURL(/\/genome\/1282460\.2049$/);
    await expect(genome.heading).toBeVisible();
    await genome.settle();

    await page.goForward();
    await genome.expectUrlParams({ tab: "features", "features.sort": null });
    await genome.expectRow(/replicase polyprotein/);
    await genome.settle();
    await page.goForward();
    await genome.expectUrlParams({
      tab: "features",
      "features.sort": "product:asc",
    });
    // The restored table has loaded, so the page has hydrated and a tab click will be handled.
    await genome.expectRow(/replicase polyprotein/);
    await genome.expectSort("Product", "ascending");
    await genome.settle();

    // Another tab must not inherit the Features table's sort.
    await genome.openTab("Sequences");
    await expect(page).toHaveURL(/\/genome\/1282460\.2049\?tab=sequences$/);
    await genome.expectRow(/JX869059/);
  });
});
