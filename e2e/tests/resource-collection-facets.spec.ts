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
 * A resource collection reads its facet counts apart from its rows, and only
 * once the user reaches for them: nothing before the Filters menu (or a pill)
 * opens, then one request for the pinned facets of the scope (each facet its
 * own query, batched), and one more per facet the user turns on. A field's
 * counts leave its own filter out, so a pick re-reads the other fields only.
 * The unit suites pin each half against a stubbed hook or a stubbed table;
 * this spec is the real page: the preference provider, the saved table
 * layout, the toolbar, the hook and the gateway requests they add up to.
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
    // The menu is closed: the rows and the next-page prefetch are read, and
    // no counts at all.
    await expect.poll(() => rowPages).toContain("2");
    expect(reads).toHaveLength(0);

    await toolbar.openFilters();
    await toolbar.openFacet("Genome Status");
    await expect(
      toolbar.facetValueOption("Genome Status", "Complete", 5),
    ).toBeVisible();
    // One read for every pinned facet. Pointing at Filters starts it, and the
    // opened menu joins that read rather than sending its own.
    expect(reads).toHaveLength(1);
    const [read] = reads;
    // A count read, not a page of rows: one row, no page, no sort.
    expect(read.searchParams.get("pageSize")).toBe("1");
    expect(read.searchParams.has("page")).toBe(false);
    expect(read.searchParams.has("sort")).toBe(false);
    expect(read.searchParams.get("keyword")).toBe("influenza");
    // Exactly the pinned facets: Genome Status is pinned by default,
    // Superkingdom and Genus start under More.
    const requested = facetsOf(read);
    await expect(toolbar.pinnedFacetOptions()).toHaveCount(requested.length);
    expect(requested).toContain("genome_status");
    expect(requested).not.toContain("superkingdom");
    expect(requested).not.toContain("genus");

    await toolbar.closeFilters();
    await collection.goToPage(2);
    await expect(collection.rowCheckbox(secondRow.genome_id)).toBeVisible();
    // Counts depend on the scope, not the page.
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

    // Unfolding More counts every facet in it, in one read, and none of the
    // pinned ones again.
    await toolbar.openFacet("Genus");
    await expect.poll(() => reads.length).toBe(2);
    const more = facetsOf(reads[1]);
    expect(more).toContain("genus");
    expect(more).toContain("superkingdom");
    expect(more).not.toContain("genome_status");
    // Until Genus is counted, its checklist holds placeholders rather than
    // "No values", and the counted facets keep their counts.
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
    // Pinning the peeked facet keeps its counts: nothing is read again, and
    // it opens with the pinned set from now on.
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
    // Genome Status's counts leave its own filter out, so its scope is
    // unchanged and it is not read again; every other pinned facet is, in one
    // request carrying the filter.
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
    // Clearing the filter returns to the first scope, whose counts are still
    // fresh: nothing is read.
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

  test("shows why the counts could not be loaded, keeps the rows, and retries the counts alone", async ({
    page,
  }) => {
    const collection = await openGenomeCollection(page);
    const { toolbar } = collection;
    // A 502 is an upstream outage, which the app's query client does not
    // retry on its own (`shouldRetryQuery`): one failed read reports it.
    // Every count read fails until the upstream recovers. Opening the menu can
    // re-read counts whose hover prefetch failed, so the number of failed reads
    // before the alert depends on timing; the Retry is the read after recovery.
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
    // A failed count read leaves the table usable.
    await expect(collection.rowCheckbox(firstRow.genome_id)).toBeVisible();

    const failedReads = reads.length;
    upstreamDown = false;
    await toolbar.retryFacets();
    await expect(toolbar.facetError()).toHaveCount(0);
    await toolbar.openFacet("Genome Status");
    await expect(
      toolbar.facetValueOption("Genome Status", "Complete", 5),
    ).toBeVisible();
    // The Retry re-reads the failed counts in one request, and no rows.
    expect(reads).toHaveLength(failedReads + 1);
    expect(facetsOf(reads.at(-1))).toEqual(facetsOf(reads[0]));
  });
});
