import type { Page, Request, Route } from "@playwright/test";
import type { JsonOverride } from "../mocks/backends";
import { applyBackendMocks, expect, test } from "../mocks/backends";
import {
  emptyBackendFallbackOverrides,
  genomeScenarioOverrides,
} from "../fixtures/overrides";
import { ResourceCollectionPage, TaxonPage } from "../pages";

test.use({ storageState: { cookies: [], origins: [] } });

/**
 * Facet counts are read apart from rows, only once the user reaches for them (Filters
 * menu or a pill). A field's counts leave its own filter out. This spec covers the real
 * page; the unit suites stub the hook or table.
 */

// Taxon 11520 (Orthomyxoviridae) offers the Genomes tab.
const influenzaTaxonId = "11520";

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
    isolation_country: [{ value: "USA", count: 5 }],
    state_province: [{ value: "Texas", count: 3 }],
    geographic_group: [{ value: "North America", count: 4 }],
    subtype: [{ value: "H1N1", count: 4 }],
    h_type: [{ value: "5", count: 2 }],
    n_type: [{ value: "1", count: 2 }],
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

function rqlOf(read: URL | undefined) {
  return read?.searchParams.get("rql") ?? "";
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

/** The `rql` of every Genome rows read (not a facet count read), in order. */
function recordRowQueries(page: Page) {
  const queries: string[] = [];
  page.on("request", (request: Request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/data/genome" && !isFacetRead(url)) {
      queries.push(url.searchParams.get("rql") ?? "");
    }
  });
  return queries;
}

/**
 * Holds the app's RSC navigation request to `pathname` whose address
 * `matches` (a pick's `router.push`; prefetches pass) until `release` is
 * called; `requested` settles once it is held.
 */
async function holdNavigation(
  page: Page,
  pathname: string,
  matches: (url: URL) => boolean,
) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let markRequested!: () => void;
  const requested = new Promise<void>((resolve) => {
    markRequested = resolve;
  });
  await page.route(
    (url) => url.pathname === pathname && url.searchParams.has("_rsc"),
    async (route) => {
      const request = route.request();
      const headers = request.headers();
      const url = new URL(request.url());
      if (
        headers.rsc === "1" &&
        !("next-router-prefetch" in headers) &&
        matches(url)
      ) {
        markRequested();
        await released;
      }
      await route.fallback();
    },
  );
  return { requested, release };
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

  test("narrows a custom-query list by a pick instead of replacing the query", async ({
    page,
  }) => {
    // A "Show these genomes" link: a hand-written rql, no friendly filters.
    const customClauses = [
      "in(taxon_lineage_ids,(3050294))",
      "ne(genome_status,Deprecated)",
    ];
    const customRql = `and(${customClauses.join(",")})`;
    const picked = "eq(genome_status,Complete)";
    const collection = await openGenomeCollection(page);
    const { toolbar } = collection;
    const facetReads = await routeFacetReads(page);
    const rowReads: URL[] = [];
    page.on("request", (request: Request) => {
      const url = new URL(request.url());
      if (
        url.pathname === "/api/data/genome" &&
        url.searchParams.get("operation") === "collection" &&
        !isFacetRead(url)
      ) {
        rowReads.push(url);
      }
    });

    await collection.gotoQuery(`rql=${customRql}`);
    await expect(toolbar.customQueryBadge()).toBeVisible();
    await toolbar.openFacet("Genome Status");
    await expect(
      toolbar.facetValueOption("Genome Status", "Complete", 5),
    ).toBeVisible();
    // The reads capture the rql they carry before the pick: a pick that
    // dropped the query could not be told from a capture that never saw it.
    expect(facetReads).toHaveLength(1);
    for (const read of [rowReads[0], facetReads[0]]) {
      for (const clause of customClauses) {
        expect(rqlOf(read)).toContain(clause);
      }
      expect(rqlOf(read)).not.toContain(picked);
    }

    await toolbar.pickFacetValue("Genome Status", "Complete");
    // The pick lands beside the query in the URL; it used to replace it
    // (`/genome?genome_status=Complete`).
    await expect(page).toHaveURL(/[?&]genome_status=Complete(?:&|$)/);
    expect(new URL(page.url()).searchParams.get("rql")).toBe(customRql);
    await expect(toolbar.filtersButton()).toHaveAccessibleName(
      "Filters, 1 active",
    );
    await expect(toolbar.customQueryBadge()).toBeVisible();

    // Rows and the other facets' counts are both read for the query narrowed
    // by the pick (Genome Status keeps its own counts, so it is not re-read).
    await expect.poll(() => facetReads.length).toBe(2);
    await expect
      .poll(() => rowReads.some((read) => rqlOf(read).includes(picked)))
      .toBe(true);
    const narrowed = [
      facetReads[1],
      ...rowReads.filter((read) => rqlOf(read).includes(picked)),
    ];
    for (const read of narrowed) {
      for (const clause of [...customClauses, picked]) {
        expect(rqlOf(read)).toContain(clause);
      }
    }
    expect(facetsOf(facetReads[1])).not.toContain("genome_status");

    // The server renders the same list from the link.
    await toolbar.closeFilters();
    await page.reload();
    await expect(collection.rowCheckbox(firstRow.genome_id)).toBeVisible();
    await expect(toolbar.filtersButton()).toHaveAccessibleName(
      "Filters, 1 active",
    );
    await expect(toolbar.customQueryBadge()).toBeVisible();
    expect(new URL(page.url()).searchParams.get("rql")).toBe(customRql);
    expect(new URL(page.url()).searchParams.get("genome_status")).toBe(
      "Complete",
    );
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

  test("keeps a pick on every facet reported in DXKBCORE-344", async ({
    page,
  }) => {
    const collection = await openGenomeCollection(page);
    const { toolbar } = collection;
    await routeFacetReads(page);
    const queries = recordRowQueries(page);

    await collection.goto("influenza");
    // The overlay shows a pick as selected while its navigation is pending
    // whether or not the page keeps it, so each pick is checked in the URL
    // and in the rows read, not by `aria-selected`.
    const picks = [
      ["Isolation Country", "isolation_country", "USA", "eq(isolation_country,USA)"],
      ["State/Province", "state_province", "Texas", "eq(state_province,Texas)"],
      [
        "Geographic Group",
        "geographic_group",
        "North America",
        'eq(geographic_group,"North%20America")',
      ],
      ["Segment", "segment", "4", "eq(segment,4)"],
      ["Subtype", "subtype", "H1N1", "eq(subtype,H1N1)"],
      ["H_type", "h_type", "5", "eq(h_type,5)"],
      ["N_type", "n_type", "1", "eq(n_type,1)"],
    ] as const;
    for (const [label, field, value, clause] of picks) {
      await toolbar.pickFacetValue(label, value);
      await expect(page).toHaveURL(
        (url) => url.searchParams.get(field) === value,
      );
      await expect
        .poll(() => queries.at(-1) ?? "", { message: `rows read with ${clause}` })
        .toContain(clause);
    }
    await expect(toolbar.filtersButton()).toHaveAccessibleName(
      `Filters, ${String(picks.length)} active`,
    );

    await toolbar.closeFilters();
    // Pills follow the facet order; those past the toolbar's width fold into
    // one "+N" button that names them.
    await expect(toolbar.activeFilterPill("Segment")).toHaveAccessibleName(
      "Segment: 4. Edit filter",
    );
    const shownPills = await toolbar.activeFilterPills().count();
    const foldedPills = picks.length - shownPills;
    await expect(toolbar.moreFiltersButton()).toHaveAccessibleName(
      new RegExp(
        `^${String(foldedPills)} more filters: .*Isolation Country, State/Province, Geographic Group\\.`,
      ),
    );

    // The URL holds every pick, so a reload keeps them.
    await page.reload();
    await expect(toolbar.filtersButton()).toHaveAccessibleName(
      `Filters, ${String(picks.length)} active`,
    );
    await expect(toolbar.activeFilterPills()).toHaveCount(shownPills);
    await expect(toolbar.moreFiltersButton()).toHaveAccessibleName(
      new RegExp(`^${String(foldedPills)} more filters: `),
    );
  });

  test("keeps a pick while the page is slow to answer", async ({ page }) => {
    const collection = await openGenomeCollection(page);
    const { toolbar } = collection;
    await routeFacetReads(page);
    const queries = recordRowQueries(page);
    const navigation = await holdNavigation(
      page,
      "/genome",
      (url) => url.searchParams.get("isolation_country") === "USA",
    );

    await collection.goto("influenza");
    await toolbar.openFacet("Isolation Country");
    const option = toolbar.facetValueOption("Isolation Country", "USA");
    const selection = await toolbar.watchValueSelection(
      "Isolation Country",
      "USA",
    );
    await option.click();
    await navigation.requested;

    // Past the 3 s the overlay used to last, with the navigation still held.
    await page.waitForTimeout(4_000);
    await expect(option).toHaveAttribute("aria-selected", "true");
    expect(new URL(page.url()).searchParams.has("isolation_country")).toBe(
      false,
    );
    expect(queries.some((rql) => rql.includes("isolation_country"))).toBe(
      false,
    );

    navigation.release();
    await expect(page).toHaveURL(
      (url) => url.searchParams.get("isolation_country") === "USA",
    );
    await expect
      .poll(() => queries.at(-1) ?? "")
      .toContain("eq(isolation_country,USA)");
    await expect(option).toHaveAttribute("aria-selected", "true");
    expect(await selection()).toEqual(["false", "true"]);
  });

  test("keeps a Segment pick on the taxon Genomes tab", async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [...genomeScenarioOverrides, ...emptyBackendFallbackOverrides],
    });
    await routeFacetReads(page);
    const queries = recordRowQueries(page);
    const taxon = new TaxonPage(page);

    await taxon.goto(influenzaTaxonId, "genomes");
    await taxon.toolbar.pickFacetValue("Segment", "4");

    await expect(page).toHaveURL(
      (url) =>
        url.searchParams.get("tab") === "genomes" &&
        url.searchParams.get("segment") === "4",
    );
    await expect.poll(() => queries.at(-1) ?? "").toContain("eq(segment,4)");
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
