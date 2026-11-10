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
 * Facet counts are read apart from rows, only once the user reaches for them (Filters
 * menu or a pill). A field's counts leave its own filter out. This spec covers the real
 * page; the unit suites stub the hook or table.
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
    segment: [
      { value: "4", count: 5 },
      { value: "", count: 3 },
    ],
    culture_collection: [{ value: "FDA:FDAARGOS_855", count: 2 }],
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
 * Answers every facet read with counts for exactly the facets asked for; `respond` can
 * hold or fail a read. Registered after applyBackendMocks, so it is matched first.
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

function facetsOf(read: URL | undefined) {
  return read?.searchParams.getAll("facet") ?? [];
}

/** Holds the reads `held` matches until `release` is called. */
function holdReads(held: (url: URL) => boolean) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const respond = async (route: Route, url: URL) => {
    if (held(url)) await released;
    await route.fulfill({
      json: {
        rows: [],
        total: 401,
        facets: facetCounts(url.searchParams.getAll("facet")),
        page: 1,
        pageSize: 1,
      },
    });
  };
  return { respond, release };
}

test.describe("resource collection facet counts", () => {
  test("reads no counts before Filters opens, then the pinned facets in one read, and none for a page change", async ({
    page,
  }) => {
    const collection = await openGenomeCollection(page);
    const { toolbar } = collection;
    const reads = await routeFacetReads(page);
    const rowPages: string[] = [];
    page.on("request", (request: Request) => {
      const url = new URL(request.url());
      if (url.pathname === "/api/data/genome" && !isFacetRead(url)) {
        rowPages.push(url.searchParams.get("page") ?? "");
      }
    });

    await collection.goto("influenza");
    await expect.poll(() => rowPages).toContain("2");
    expect(reads).toHaveLength(0);

    await toolbar.openFilters();
    await toolbar.openFacet("Genome Status");
    await expect(
      toolbar.facetValueOption("Genome Status", "Complete", 5),
    ).toBeVisible();
    expect(reads).toHaveLength(1);
    const [read] = reads;
    expect(read.searchParams.get("pageSize")).toBe("1");
    expect(read.searchParams.has("page")).toBe(false);
    expect(read.searchParams.has("sort")).toBe(false);
    expect(read.searchParams.get("keyword")).toBe("influenza");
    const requested = facetsOf(read);
    await expect(toolbar.pinnedFacetOptions()).toHaveCount(requested.length);
    expect(requested).toContain("genome_status");
    expect(requested).not.toContain("superkingdom");
    expect(requested).not.toContain("genus");

    await toolbar.closeFilters();
    await collection.goToPage(2);
    await expect(collection.rowCheckbox(secondRow.genome_id)).toBeVisible();
    await toolbar.openFilters();
    await toolbar.openFacet("Genome Status");
    await expect(
      toolbar.facetValueOption("Genome Status", "Complete", 5),
    ).toBeVisible();
    expect(reads).toHaveLength(1);
  });

  test("counts the More facets together once More is unfolded, leaving the counted ones as they are", async ({
    page,
  }) => {
    const collection = await openGenomeCollection(page);
    const { toolbar } = collection;
    const genus = holdReads((url) => facetsOf(url).includes("genus"));
    const reads = await routeFacetReads(page, genus.respond);

    await collection.goto("influenza");
    await toolbar.openFacet("Genome Status");
    await expect(
      toolbar.facetValueOption("Genome Status", "Complete", 5),
    ).toBeVisible();
    expect(reads).toHaveLength(1);

    await toolbar.openFacet("Genus");
    await expect.poll(() => reads.length).toBe(2);
    const more = facetsOf(reads[1]);
    expect(more).toContain("genus");
    expect(more).toContain("superkingdom");
    expect(more).not.toContain("genome_status");
    await expect(toolbar.valuePlaceholders("Genus").first()).toBeAttached();
    await expect(toolbar.noValues("Genus")).toHaveCount(0);
    await toolbar.openFacet("Genome Status");
    await expect(
      toolbar.facetValueOption("Genome Status", "Complete", 5),
    ).toBeVisible();
    await expect(toolbar.valuePlaceholders("Genome Status")).toHaveCount(0);

    genus.release();
    await toolbar.openFacet("Genus");
    await expect(
      toolbar.facetValueOption("Genus", "Alphainfluenzavirus", 5),
    ).toBeVisible();
    await expect(toolbar.valuePlaceholders("Genus")).toHaveCount(0);
    await expect(toolbar.pinToggle()).toHaveAttribute("aria-pressed", "false");
    await toolbar.pinToggle().click();
    await expect(toolbar.pinToggle()).toHaveAttribute("aria-pressed", "true");
    await toolbar.closeFilters();
    await toolbar.openFilters();
    await expect(toolbar.facetOption("Genus")).toHaveAccessibleName(
      "Genus, pinned",
    );
    await toolbar.openFacet("Genus");
    await expect(
      toolbar.facetValueOption("Genus", "Alphainfluenzavirus", 5),
    ).toBeVisible();
    expect(reads).toHaveLength(2);
  });

  test("after a pick, re-reads the other facets with the filter and keeps the picked facet's own counts", async ({
    page,
  }) => {
    const collection = await openGenomeCollection(page);
    const { toolbar } = collection;
    const reads = await routeFacetReads(page);

    await collection.goto("influenza");
    await toolbar.openFacet("Genome Status");
    await expect(
      toolbar.facetValueOption("Genome Status", "Complete", 5),
    ).toBeVisible();
    expect(reads).toHaveLength(1);
    const pinned = facetsOf(reads[0]);

    await toolbar.pickFacetValue("Genome Status", "Complete");
    await expect(toolbar.filtersButton()).toHaveAccessibleName(
      "Filters, 1 active",
    );
    await expect.poll(() => reads.length).toBe(2);
    const afterPick = reads[1];
    expect(facetsOf(afterPick)).toEqual(
      pinned.filter((field) => field !== "genome_status"),
    );
    expect(afterPick.searchParams.get("rql")).toContain(
      "eq(genome_status,Complete)",
    );
    await expect(
      toolbar.facetValueOption("Genome Status", "Complete", 5),
    ).toHaveAttribute("aria-selected", "true");

    await toolbar.closeFilters();
    await expect(toolbar.activeFilterPill("Genome Status")).toHaveAccessibleName(
      "Genome Status: Complete. Edit filter",
    );
    await toolbar.clearFilter("Genome Status");
    await expect(toolbar.activeFilterPill("Genome Status")).toHaveCount(0);
    await expect(toolbar.filtersButton()).toHaveAccessibleName("Filters");
    await toolbar.openFacet("Genome Status");
    await expect(
      toolbar.facetValueOption("Genome Status", "Complete", 5),
    ).toHaveAttribute("aria-selected", "false");
    expect(reads).toHaveLength(2);
    expect(
      reads.some((read) =>
        facetsOf(read).includes("genome_status") &&
        read.searchParams.get("rql")?.includes("genome_status"),
      ),
    ).toBe(false);
  });

  test("keeps a pick on a facet the URL used to drop, on its (empty) bucket, and on a value with a colon", async ({
    page,
  }) => {
    const collection = await openGenomeCollection(page);
    const { toolbar } = collection;
    await routeFacetReads(page);
    const queries: string[] = [];
    page.on("request", (request: Request) => {
      const url = new URL(request.url());
      if (url.pathname === "/api/data/genome") {
        queries.push(url.searchParams.get("rql") ?? "");
      }
    });

    await collection.goto("influenza");
    // Segment is a facet Genome's URL state did not accept, so a pick on it
    // highlighted and then cleared. Its "(empty)" bucket is the value "".
    await toolbar.pickFacetValue("Segment", "(empty)");
    await expect(page).toHaveURL(/[?&]segment=(?:&|$)/);
    await expect(toolbar.filtersButton()).toHaveAccessibleName(
      "Filters, 1 active",
    );
    await expect
      .poll(() => queries.some((rql) => rql.includes('eq(segment,"")')))
      .toBe(true);
    await expect(
      toolbar.facetValueOption("Segment", "(empty)", 3),
    ).toHaveAttribute("aria-selected", "true");

    // A bare colon is a Solr field separator (HTTP 400), so the value is quoted.
    await toolbar.pickFacetValue("Culture Collection", "FDA:FDAARGOS_855");
    await expect(page).toHaveURL(
      /[?&]culture_collection=FDA:FDAARGOS_855(?:&|$)/,
    );
    await expect(toolbar.filtersButton()).toHaveAccessibleName(
      "Filters, 2 active",
    );
    await expect
      .poll(() =>
        queries.some((rql) =>
          rql.includes('eq(culture_collection,"FDA%3AFDAARGOS_855")'),
        ),
      )
      .toBe(true);

    await toolbar.closeFilters();
    await expect(toolbar.activeFilterPill("Segment")).toHaveAccessibleName(
      "Segment: (empty). Edit filter",
    );
    await expect(
      toolbar.activeFilterPill("Culture Collection"),
    ).toHaveAccessibleName("Culture Collection: FDA:FDAARGOS_855. Edit filter");

    // Both survive a reload: the URL holds them.
    await page.reload();
    await expect(toolbar.filtersButton()).toHaveAccessibleName(
      "Filters, 2 active",
    );
  });

  test("shows why the counts could not be loaded, keeps the rows, and retries the counts alone", async ({
    page,
  }) => {
    const collection = await openGenomeCollection(page);
    const { toolbar } = collection;
    // A 502 is not retried by the query client (`shouldRetryQuery`); how many failed
    // reads precede the alert depends on timing.
    let upstreamDown = true;
    const reads = await routeFacetReads(page, async (route, url) => {
      if (upstreamDown) {
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
    await toolbar.openFacet("Genome Status");

    await expect(toolbar.facetError()).toHaveText(
      /Could not load filter values: Facet query timed out upstream\./,
    );
    await toolbar.closeFilters();
    await expect(collection.rowCheckbox(firstRow.genome_id)).toBeVisible();

    const failedReads = reads.length;
    upstreamDown = false;
    await toolbar.retryFacets();
    await expect(toolbar.facetError()).toHaveCount(0);
    await toolbar.openFacet("Genome Status");
    await expect(
      toolbar.facetValueOption("Genome Status", "Complete", 5),
    ).toBeVisible();
    expect(reads).toHaveLength(failedReads + 1);
    expect(facetsOf(reads.at(-1))).toEqual(facetsOf(reads[0]));
  });
});
