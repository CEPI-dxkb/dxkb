import { emptyBackendFallbackOverrides } from "../fixtures/overrides";
import { applyBackendMocks, expect, test } from "../mocks/backends";
import { LegacySearchPage } from "../pages";

test.use({ storageState: { cookies: [], origins: [] } });

/**
 * `/search?type=genome_sequence` is one of the two lists item 29 kept. What is
 * only checkable in a real browser:
 *
 * 1. Its reads are same-origin. `ListData` used to read `NEXT_PUBLIC_DATA_API`
 *    and fetch the upstream service directly, which is inlined at build time
 *    and so cannot be pointed at the E2E loopback. Only the gateway path is
 *    mocked below, and `applyBackendMocks`' strict guard aborts (and fails on)
 *    any request to an upstream host — so a regression back to a direct fetch
 *    breaks this spec rather than passing quietly.
 * 2. The table is virtualized, so its rows, checkboxes and the action bar's
 *    response to a selection do not render in jsdom (the Vitest suite asserts
 *    on the footer count for exactly that reason).
 */

const sequenceRows = [
  {
    sequence_id: "94625.28.con.0340",
    genome_id: "94625.28",
    genome_name: "Influenza A virus",
    accession: "CY000001",
    description: "segment 4 hemagglutinin",
    sequence_type: "plasmid",
    length: 1701,
  },
  {
    // No genome_id: the GENOME action has nothing to open for this row.
    sequence_id: "94625.28.con.0341",
    genome_name: "Influenza A virus",
    accession: "CY000002",
    description: "segment 6 neuraminidase",
    sequence_type: "plasmid",
    length: 1410,
  },
];

const sequenceCollectionOverrides = [
  {
    url: /\/api\/data\/genome_sequence\?.*operation=collection/,
    method: "GET",
    body: {
      rows: sequenceRows,
      total: sequenceRows.length,
      facets: { sequence_type: [{ value: "plasmid", count: 2 }] },
      page: 1,
      pageSize: 200,
    },
  },
  {
    url: /\/api\/data\/genome_sequence\?.*operation=member/,
    method: "GET",
    body: { row: sequenceRows[0] },
  },
  ...emptyBackendFallbackOverrides,
];

test.describe("legacy search list", () => {
  test("reads the surviving genomic-sequence list through the same-origin gateway", async ({
    page,
    baseURL,
  }) => {
    // Only the data reads the client makes, not the document navigation (whose
    // own URL names the resource too).
    const dataRequests: string[] = [];
    page.on("request", (request) => {
      if (
        ["fetch", "xhr"].includes(request.resourceType()) &&
        request.url().includes("genome_sequence")
      ) {
        dataRequests.push(request.url());
      }
    });
    await applyBackendMocks(page, { overrides: sequenceCollectionOverrides });
    const searchPage = new LegacySearchPage(page, "genome_sequence");

    await searchPage.goto("influenza");

    await searchPage.expectRowVisible("94625.28.con.0340");
    await searchPage.expectTotal(2);

    expect(dataRequests.length).toBeGreaterThan(0);
    for (const url of dataRequests) {
      expect(url.startsWith(baseURL ?? "")).toBe(true);
      expect(new URL(url).pathname).toBe("/api/data/genome_sequence");
    }
  });

  test("offers GENOME only when the selected row has a genome to open", async ({
    page,
  }) => {
    await applyBackendMocks(page, { overrides: sequenceCollectionOverrides });
    const searchPage = new LegacySearchPage(page, "genome_sequence");

    await searchPage.goto("influenza");
    await searchPage.expectRowVisible("94625.28.con.0340");

    // The GUIDE action renders because this type has a quick-reference URL.
    await expect(searchPage.action("GUIDE")).toBeVisible();

    await searchPage.selectRow("94625.28.con.0340");
    await expect(searchPage.action("G GENOME")).toBeEnabled();

    await searchPage.rowCheckbox("94625.28.con.0340").uncheck();
    await searchPage.selectRow("94625.28.con.0341");
    // Same action, row with no genome_id: disabled with a reason rather than
    // enabled and inert.
    await expect(searchPage.action("G GENOME")).toBeDisabled();
  });

  test("opens the facet chooser as a real menu", async ({ page }) => {
    await applyBackendMocks(page, { overrides: sequenceCollectionOverrides });
    const searchPage = new LegacySearchPage(page, "genome_sequence");

    await searchPage.goto("influenza");
    await searchPage.expectRowVisible("94625.28.con.0340");

    await searchPage.showFilters();
    const trigger = searchPage.facetChooserTrigger();
    await trigger.focus();
    await page.keyboard.press("Enter");

    await expect(searchPage.facetOption("Sequence Type")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(searchPage.facetOption("Sequence Type")).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe("legacy search list: AMR phenotypes", () => {
  // The second surviving type. What is type-specific and browser-only: its
  // action bar is nearly empty by design, and that is only observable once the
  // virtualized table has rendered a row and a selection has been made.
  const amrRow = {
    id: "1a2b3c",
    genome_id: "1313.5678",
    genome_name: "Streptococcus pneumoniae",
    antibiotic: "ampicillin",
    resistant_phenotype: "Resistant",
    measurement_value: ">=32",
    pmid: ["12345", "67890"],
    evidence: ["Laboratory Method"],
  };

  const amrOverrides = [
    {
      url: /\/api\/data\/genome_amr\?.*operation=collection/,
      method: "GET",
      body: {
        rows: [amrRow],
        total: 1,
        facets: { antibiotic: [{ value: "ampicillin", count: 1 }] },
        page: 1,
        pageSize: 200,
      },
    },
    ...emptyBackendFallbackOverrides,
  ];

  test("renders AMR rows from the gateway with the action bar its type actually supports", async ({
    page,
    baseURL,
  }) => {
    const dataRequests: string[] = [];
    page.on("request", (request) => {
      if (
        ["fetch", "xhr"].includes(request.resourceType()) &&
        request.url().includes("genome_amr")
      ) {
        dataRequests.push(request.url());
      }
    });
    await applyBackendMocks(page, { overrides: amrOverrides });
    const searchPage = new LegacySearchPage(page, "genome_amr");

    await searchPage.goto("ampicillin");

    await searchPage.expectRowVisible("1a2b3c");
    await searchPage.expectTotal(1);
    expect(dataRequests.length).toBeGreaterThan(0);
    for (const url of dataRequests) {
      expect(url.startsWith(baseURL ?? "")).toBe(true);
      expect(new URL(url).pathname).toBe("/api/data/genome_amr");
    }

    // No GUIDE: AMR Phenotypes has no quick reference in the doc set this app
    // links to, and `SearchActionBar` hides the button rather than offering a
    // dead one.
    await expect(searchPage.action("GUIDE")).toHaveCount(0);

    await searchPage.selectRow("1a2b3c");
    // GENOME does not list genome_amr in its validSearchTypes, so selecting a
    // row must not produce one — this is the deleted action wiring staying
    // deleted.
    await expect(searchPage.action("G GENOME")).toHaveCount(0);
    // SERVICES is "*" and disabled by the shared action config, so the bar is
    // not empty — it is honest.
    await expect(searchPage.action("SERVICES")).toBeDisabled();
  });
});
