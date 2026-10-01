import type { Page, Request, Route } from "@playwright/test";
import type { JsonOverride } from "../mocks/backends";
import { applyBackendMocks, expect, test } from "../mocks/backends";
import {
  emptyBackendFallbackOverrides,
  genomeScenarioOverrides,
} from "../fixtures/overrides";
import { ResourceCollectionPage } from "../pages";

test.use({ storageState: { cookies: [], origins: [] } });

/**
 * A resource collection reads its facet counts apart from its rows, and only for
 * the facets its filter panel shows. The unit suites pin each half against a
 * stubbed hook or a stubbed table; this spec is the real page: the preference
 * provider, the saved table layout, the filter bar, the hook and the gateway
 * requests they add up to.
 */

const firstRow = { genome_id: "1282460.2049", genome_name: "Selected genome" };
const secondRow = { genome_id: "1282460.2050", genome_name: "Next genome" };

function isFacetRead(url: URL) {
  return (
    url.pathname === "/api/data/genome" &&
    url.searchParams.get("operation") === "collection" &&
    url.searchParams.getAll("facet").length > 0
  );
}

function facetCounts(fields: readonly string[]) {
  const counts: Record<string, { value: string; count: number }[]> = {
    genome_status: [{ value: "Complete", count: 5 }],
    genus: [{ value: "Alphainfluenzavirus", count: 5 }],
  };
  return Object.fromEntries(fields.map((field) => [field, counts[field] ?? []]));
}

/** Rows for pages 1 and 2 of a 401-row Genome collection. */
const rowOverrides: JsonOverride[] = [
  { page: 1, row: firstRow },
  { page: 2, row: secondRow },
].map(({ page, row }) => ({
  url: new RegExp(
    `/api/data/genome(?=[^#]*[?&]operation=collection(?:&|$))(?=[^#]*[?&]page=${String(page)}(?:&|$))`,
  ),
  method: "GET",
  body: { rows: [row], total: 401, facets: {}, page, pageSize: 200 },
}));

/**
 * Answers every facet read with counts for exactly the facets it asked for.
 * `respond` can hold a read (or fail it) to observe the states in between.
 * Registered after `applyBackendMocks`, so it is matched first.
 */
async function routeFacetReads(
  page: Page,
  respond: (route: Route, url: URL, index: number) => Promise<void> = (
    route,
    url,
  ) =>
    route.fulfill({
      json: {
        rows: [],
        total: 401,
        facets: facetCounts(url.searchParams.getAll("facet")),
        page: 1,
        pageSize: 1,
      },
    }),
) {
  const reads: URL[] = [];
  await page.route(
    (url) => isFacetRead(url),
    async (route) => {
      const url = new URL(route.request().url());
      reads.push(url);
      await respond(route, url, reads.length - 1);
    },
  );
  return reads;
}

async function openGenomeCollection(page: Page) {
  await applyBackendMocks(page, {
    overrides: [
      ...rowOverrides,
      ...genomeScenarioOverrides,
      ...emptyBackendFallbackOverrides,
    ],
  });
  const collection = new ResourceCollectionPage(
    page,
    "genome",
    "genome",
    firstRow.genome_id,
    firstRow.genome_name,
  );
  return collection;
}

test.describe("resource collection facet counts", () => {
  test("counts only the shown facets once the panel opens, and not again for a page change", async ({
    page,
  }) => {
    const collection = await openGenomeCollection(page);
    const reads = await routeFacetReads(page);
    const rowPages: string[] = [];
    page.on("request", (request: Request) => {
      const url = new URL(request.url());
      if (url.pathname === "/api/data/genome" && !isFacetRead(url)) {
        rowPages.push(url.searchParams.get("page") ?? "");
      }
    });

    await collection.goto("influenza");
    // The panel is closed by default: the rows and the next-page prefetch are
    // read, and no counts at all.
    await expect.poll(() => rowPages).toContain("2");
    expect(reads).toHaveLength(0);

    await collection.showFilters();
    await expect(collection.facetValue("Complete (5)")).toBeVisible();
    expect(reads).toHaveLength(1);
    const [read] = reads;
    // A count read, not a page of rows: one row, no page, no sort.
    expect(read.searchParams.get("pageSize")).toBe("1");
    expect(read.searchParams.has("page")).toBe(false);
    expect(read.searchParams.has("sort")).toBe(false);
    expect(read.searchParams.get("keyword")).toBe("influenza");
    // Exactly the facets the panel shows: Genome Status is shown by default,
    // Superkingdom and Genus start collapsed.
    const requested = read.searchParams.getAll("facet");
    expect(requested).toContain("genome_status");
    expect(requested).not.toContain("superkingdom");
    expect(requested).not.toContain("genus");
    await collection.openFacetChooser();
    await expect(collection.checkedFacetOptions()).toHaveCount(
      requested.length,
    );
    await collection.closeFacetChooser();

    await collection.goToPage(2);
    await expect(collection.rowCheckbox(secondRow.genome_id)).toBeVisible();
    // Counts depend on the scope, not the page.
    expect(reads).toHaveLength(1);
  });

  test("keeps the counts on screen, marked stale, while a facet the user turns on is counted", async ({
    page,
  }) => {
    const collection = await openGenomeCollection(page);
    let releaseWiderSet!: () => void;
    const widerSetHeld = new Promise<void>((resolve) => {
      releaseWiderSet = resolve;
    });
    const reads = await routeFacetReads(page, async (route, url) => {
      if (url.searchParams.getAll("facet").includes("genus")) {
        await widerSetHeld;
      }
      await route.fulfill({
        json: {
          rows: [],
          total: 401,
          facets: facetCounts(url.searchParams.getAll("facet")),
          page: 1,
          pageSize: 1,
        },
      });
    });

    await collection.goto("influenza");
    await collection.showFilters();
    await expect(collection.facetValue("Complete (5)")).toBeVisible();
    // The mock counts nothing for the other shown facets, so they read "No values".
    const emptyColumns = await collection.emptyFacetColumns().count();

    await collection.openFacetChooser();
    await collection.facetOption("Genus").click();
    await collection.closeFacetChooser();

    await expect.poll(() => reads.length).toBe(2);
    expect(reads[1].searchParams.getAll("facet")).toContain("genus");
    // Until the wider set is counted, the shown counts stay, marked stale, and
    // the new column holds a placeholder rather than "No values".
    await expect(collection.staleFacetPanel()).toBeVisible();
    await expect(collection.facetValue("Complete (5)")).toBeVisible();
    await expect(collection.staleFacetPlaceholders().first()).toBeAttached();
    await expect(collection.emptyFacetColumns()).toHaveCount(emptyColumns);

    releaseWiderSet();
    await expect(collection.facetValue("Alphainfluenzavirus (5)")).toBeVisible();
    await expect(collection.staleFacetPanel()).toHaveCount(0);
  });

  test("shows why the counts could not be loaded, keeps the rows, and retries the counts alone", async ({
    page,
  }) => {
    const collection = await openGenomeCollection(page);
    // The app's query client retries a failed read once before it reports it.
    const reads = await routeFacetReads(page, async (route, url, index) => {
      if (index < 2) {
        await route.fulfill({
          status: 502,
          json: { error: "Facet query timed out upstream." },
        });
        return;
      }
      await route.fulfill({
        json: {
          rows: [],
          total: 401,
          facets: facetCounts(url.searchParams.getAll("facet")),
          page: 1,
          pageSize: 1,
        },
      });
    });

    await collection.goto("influenza");
    await collection.showFilters();

    await expect(collection.facetError()).toHaveText(
      /Could not load filter values: Facet query timed out upstream\./,
    );
    // A failed count read leaves the table usable.
    await expect(collection.rowCheckbox(firstRow.genome_id)).toBeVisible();

    await collection.retryFacets();
    await expect(collection.facetValue("Complete (5)")).toBeVisible();
    await expect(collection.facetError()).toHaveCount(0);
    expect(reads).toHaveLength(3);
  });
});
