import {
  test,
  expect,
  applyBackendMocks,
  type JsonOverride,
} from "../../mocks/backends";
import { permissiveBackendOverrides } from "../../fixtures/overrides";
import { TaxonPage } from "../../pages";

test.use({ storageState: { cookies: [], origins: [] } });

// Force the strain data API to return 500 so we can assert the error-handling path.
const strainApi500: JsonOverride = {
  url: /\/api\/data\/strain(?:\?|$)/,
  method: "GET",
  status: 500,
  body: { error: "Internal Server Error" },
};

// Taxon 11520 = Influenza A virus (Orthomyxoviridae). hasStrains predicate requires
// "Orthomyxoviridae" in lineage_names — bacteria like taxon 234 (Brucella) evaluate
// false and the Strains tab is disabled, so the ListData component never mounts.
const influenzaTaxonId = "11520";

test.describe("taxon strains actions", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [...permissiveBackendOverrides],
    });
    await page.goto(`/taxonomy/${influenzaTaxonId}?tab=strains`);
    await expect(page.getByText("A/California/04/2009").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("keeps compact body-cell padding and only one visible horizontal scroller", async ({
    page,
  }) => {
    const tableRegion = page.getByRole("region", {
      name: "Strains results table",
    });
    const rowCheckbox = page.getByRole("checkbox", {
      name: "Select row strain-backend-901",
    });
    const scalarCell = page
      .locator('td[data-slot="table-cell"]')
      .filter({ hasText: "A/California/04/2009" })
      .first();

    await expect(tableRegion).toBeVisible();
    await expect(rowCheckbox).toBeVisible();
    await expect(scalarCell).toBeVisible();

    const baseStyles = await page.evaluate(() => {
      const checkbox = document.querySelector<HTMLInputElement>(
        'input[aria-label="Select row strain-backend-901"]',
      );
      const scalar = [...document.querySelectorAll("td")].find(
        (cell) => cell.textContent.trim() === "A/California/04/2009",
      );
      if (!checkbox?.parentElement?.parentElement || !scalar) {
        throw new Error("Expected strain row cells were not rendered");
      }
      const selectionStyle = getComputedStyle(checkbox.parentElement.parentElement);
      const scalarStyle = getComputedStyle(scalar);
      return {
        selectionPadding: [
          selectionStyle.paddingTop,
          selectionStyle.paddingRight,
          selectionStyle.paddingBottom,
          selectionStyle.paddingLeft,
        ],
        scalarPadding: [
          scalarStyle.paddingTop,
          scalarStyle.paddingRight,
          scalarStyle.paddingBottom,
          scalarStyle.paddingLeft,
        ],
        scalarOverflowX: scalarStyle.overflowX,
      };
    });

    expect(baseStyles.selectionPadding).toEqual(["0px", "0px", "0px", "0px"]);
    expect(baseStyles.scalarPadding).toEqual(["2px", "2px", "2px", "2px"]);
    expect(baseStyles.scalarOverflowX).not.toBe("auto");

    await page.getByRole("button", { name: /Columns/ }).click();
    await page.getByText("Genome IDs", { exact: true }).click();
    const firstGenomeLink = page.getByRole("link", { name: "641501.3" });
    await expect(firstGenomeLink).toBeVisible();

    const overflowStyles = await firstGenomeLink.evaluate((link) => {
      const strip = link.parentElement;
      const cell = link.closest("td");
      const region = link.closest<HTMLElement>('[role="region"]');
      if (!strip || !cell || !region) {
        throw new Error("Expected linked cell and table scroll region");
      }
      const stripStyle = getComputedStyle(strip);
      const cellStyle = getComputedStyle(cell);
      const regionStyle = getComputedStyle(region);
      return {
        cellPadding: [
          cellStyle.paddingTop,
          cellStyle.paddingRight,
          cellStyle.paddingBottom,
          cellStyle.paddingLeft,
        ],
        stripOverflowX: stripStyle.overflowX,
        stripScrollbarWidth: stripStyle.scrollbarWidth,
        regionOverflowX: regionStyle.overflowX,
        regionCanScroll: region.scrollWidth > region.clientWidth,
      };
    });

    expect(overflowStyles.cellPadding).toEqual(["2px", "2px", "2px", "2px"]);
    expect(overflowStyles.stripOverflowX).toBe("auto");
    expect(overflowStyles.stripScrollbarWidth).toBe("none");
    expect(overflowStyles.regionOverflowX).toBe("auto");

    await page.setViewportSize({ width: 640, height: 720 });
    await expect
      .poll(() =>
        tableRegion.evaluate(
          (region) => region.scrollWidth > region.clientWidth,
        ),
      )
      .toBe(true);
  });

  test("copies selected rows", async ({ page, context, browserName }) => {
    test.skip(
      browserName !== "chromium",
      "Only Chromium accepts Playwright's clipboard-read/clipboard-write permissions; Firefox rejects them as unknown and WebKit's headless clipboard is unreliable",
    );

    const taxon = new TaxonPage(page);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await taxon.selectAllRowsOnPage();

    await page.getByRole("button", { name: /^copy$/i }).click();
    await page
      .getByRole("button", { name: "Selected Columns (with headers)" })
      .click();
    await expect(page.getByText("Copied 2 selected strains")).toBeVisible();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain("Species\tStrain\tSegment Count");
    expect(clipboard).toContain("A/California/04/2009");
    expect(clipboard).not.toContain("Genome IDs");
    expect(clipboard).not.toContain("641501.3");
  });

  // Unguarded: the associated-Genome navigation is plain routing, so every browser
  // keeps this coverage even though the clipboard assertions above are Chromium-only.
  test("opens all associated genomes", async ({ page }) => {
    const taxon = new TaxonPage(page);
    await taxon.selectAllRowsOnPage();
    await taxon.openAssociatedGenomes();

    await expect(page).toHaveURL(
      /\/genome\?rql=in\(genome_id%2C\(641501\.3%2C641501\.4%2C641501\.5\)\)/,
    );
    await expect(page.getByRole("button", { name: "Sequences" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Features" })).toBeVisible();
  });

  test("keeps the selection when a signed-out user launches BLAST", async ({
    page,
    context,
  }) => {
    await page
      .getByRole("checkbox", { name: "Select row strain-backend-901" })
      .click();
    await page
      .getByRole("complementary")
      .getByRole("button", { name: /^services$/i })
      .click();

    await expect(page).toHaveURL(`/taxonomy/${influenzaTaxonId}?tab=strains`);
    // Direct BLAST needs no workspace object, so it carries the selected Genome IDs
    // into the service tab and lets the protected route handle sign-in. Redirecting
    // from here instead discarded the selection.
    const serviceTab = context.waitForEvent("page");
    await page.getByRole("button", { name: "BLAST" }).click();
    const opened = await serviceTab;
    // The protected service route sends a signed-out user through sign-in, but the
    // rerun key survives the round trip, so the prefill is still there afterwards.
    await expect(opened).toHaveURL(
      /\/sign-in\?redirect=%2Fservices%2Fblast%3Frerun_key%3D/,
    );
    const rerunKey =
      new URL(opened.url()).searchParams
        .get("redirect")
        ?.match(/rerun_key=([^&]+)/)?.[1] ?? "";
    expect(rerunKey).not.toBe("");
    expect(
      await opened.evaluate((key) => sessionStorage.getItem(key), rerunKey),
    ).toContain("641501.3");
    await expect(page).toHaveURL(`/taxonomy/${influenzaTaxonId}?tab=strains`);
  });

  test("prompts signed-out users to sign in for Group without leaving the page", async ({
    page,
  }) => {
    await page
      .getByRole("checkbox", { name: "Select row strain-backend-901" })
      .click();
    await page.getByRole("button", { name: /^group$/i }).click();

    await expect(page.getByText("Sign in required")).toBeVisible();
    // The popover's Sign In is a Button rendered as an anchor, so it carries
    // role="button" rather than role="link".
    await expect(
      page.getByRole("dialog").getByRole("button", { name: "Sign In" }),
    ).toHaveAttribute(
      "href",
      `/sign-in?redirect=${encodeURIComponent(`/taxonomy/${influenzaTaxonId}?tab=strains`)}`,
    );
    await expect(page).toHaveURL(`/taxonomy/${influenzaTaxonId}?tab=strains`);
  });
});

test.describe("taxon strains tab: data API error handling", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [strainApi500, ...permissiveBackendOverrides],
    });
  });

  test("shows the original API error and keeps the taxon shell visible", async ({
    page,
  }) => {
    await page.goto(`/taxonomy/${influenzaTaxonId}?tab=strains`);

    await expect(page.getByText(/Internal Server Error/)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Strains" })).toBeVisible();
  });
});

// ─── Download Selected: POST regression ───────────────────────────────────────
// Regression: the download-selected handler sent a GET with all IDs in the URL.
// With 200 rows, the URL exceeded browser limits. The shared collection sends a
// bounded JSON POST through the same-origin Data API gateway instead.

const domainsTaxonId = "11974";

function buildProteinFeatureRows(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `mock-pf-${String(i).padStart(4, "0")}`,
    feature_id: `PATRIC.1.${String(i)}.CDS.1`,
    patric_id: `fig|1.${String(i)}.CDS.1`,
    refseq_locus_tag: `gp${String(i)}`,
    gene: `ORF${String(i)}`,
    product: `mock-product-${String(i)}`,
    source: "Pfam",
    source_id: "PF001",
    interpro_description: "mock domain",
    e_value: "1E-10",
    evidence: "InterProScan",
    date_inserted: "2021-07-27",
  }));
}

const pfGateway = /\/api\/data\/protein_feature(?:\?|$)/;

function proteinFeatureCollection(
  rows: ReturnType<typeof buildProteinFeatureRows>,
) {
  return {
    rows,
    total: rows.length,
    facets: {
      source: [{ value: "Pfam", count: rows.length }],
      evidence: [{ value: "InterProScan", count: rows.length }],
    },
    page: 1,
    pageSize: 200,
  };
}
const genomeFeatureBackend =
  /\/(?:data_api|api\/e2e-mock\/data)\/genome_feature\//;

test.describe("taxon data table: checkbox-column selection", () => {
  test("clicking the cell edge toggles rows additively and keeps checkboxes in sync", async ({
    page,
  }) => {
    const rows = buildProteinFeatureRows(3);
    await applyBackendMocks(page, {
      overrides: [...permissiveBackendOverrides],
    });
    await page.route(pfGateway, async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(proteinFeatureCollection(rows)),
      });
    });

    await page.goto(`/taxonomy/${domainsTaxonId}?tab=domains-and-motifs`);
    await expect(page.getByText("mock-product-0")).toBeVisible({
      timeout: 10_000,
    });

    const first = page.getByRole("checkbox", {
      name: "Select row mock-pf-0000",
    });
    const second = page.getByRole("checkbox", {
      name: "Select row mock-pf-0001",
    });
    const firstCell = first.locator("xpath=ancestor::td");
    const secondCell = second.locator("xpath=ancestor::td");

    await firstCell.click({ position: { x: 2, y: 12 } });
    await secondCell.click({ position: { x: 2, y: 12 } });
    await expect(first).toBeChecked();
    await expect(second).toBeChecked();

    await firstCell.click({ position: { x: 2, y: 12 } });
    await expect(first).not.toBeChecked();
    await expect(second).toBeChecked();
  });
});

test.describe("taxon domains-and-motifs: Download Selected sends POST not GET", () => {
  test("sends selected IDs in a JSON body, not GET params in the URL", async ({
    page,
  }) => {
    const rows = buildProteinFeatureRows(3);

    await applyBackendMocks(page, {
      overrides: [
        { url: pfGateway, method: "GET", body: proteinFeatureCollection(rows) },
        { url: pfGateway, method: "POST", body: { rows } },
        ...permissiveBackendOverrides,
      ],
    });

    const postReqPromise = page.waitForRequest(
      (req) => pfGateway.test(req.url()) && req.method() === "POST",
    );

    await page.goto(`/taxonomy/${domainsTaxonId}?tab=domains-and-motifs`);
    await expect(page.getByText("mock-product-0")).toBeVisible({
      timeout: 10_000,
    });

    await page
      .getByRole("checkbox", { name: /select all rows on this page/i })
      .click();
    await expect(
      page.getByRole("button", { name: /Download Selected \(CSV\)/i }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: /Download Selected \(CSV\)/i })
      .click();

    const postReq = await postReqPromise;
    expect(postReq.method()).toBe("POST");

    const body = postReq.postDataJSON() as {
      operation: string;
      ids: string[];
    };
    expect(body).toMatchObject({ operation: "selected" });
    expect(body.ids).toEqual(rows.map((row) => row.id));
    expect(postReq.url()).not.toContain("mock-pf-");
  });

  test("200-row selection succeeds via POST (regression: GET caused net::ERR_FAILED)", async ({
    page,
  }) => {
    const rows = buildProteinFeatureRows(200);

    await applyBackendMocks(page, {
      overrides: [
        { url: pfGateway, method: "GET", body: proteinFeatureCollection(rows) },
        { url: pfGateway, method: "POST", body: { rows } },
        ...permissiveBackendOverrides,
      ],
    });

    const postReqPromise = page.waitForRequest(
      (req) => pfGateway.test(req.url()) && req.method() === "POST",
    );

    await page.goto(`/taxonomy/${domainsTaxonId}?tab=domains-and-motifs`);
    await expect(page.getByText("mock-product-0")).toBeVisible({
      timeout: 10_000,
    });

    await page
      .getByRole("checkbox", { name: /select all rows on this page/i })
      .click();
    await page
      .getByRole("button", { name: /Download Selected \(CSV\)/i })
      .click();

    // This request would have been net::ERR_FAILED as a GET (URL too long for 200 IDs)
    const postReq = await postReqPromise;
    expect(postReq.method()).toBe("POST");

    const body = postReq.postDataJSON() as {
      operation: string;
      ids: string[];
    };
    expect(body.operation).toBe("selected");
    expect(body.ids).toHaveLength(200);
    expect(body.ids[0]).toBe("mock-pf-0000");
    expect(body.ids[199]).toBe("mock-pf-0199");
    expect(postReq.url()).not.toContain("mock-pf-");
  });
});

// ─── Facet click regression: multi-word eq() values must be quoted ───────────
// Regression: buildRql() (src/components/filterbar/filter-utils.ts) built eq()
// clauses with unquoted values. Solr string fields (e.g. epitope_type) split an
// unquoted multi-word value into separate ANDed terms —
// `eq(epitope_type,Linear peptide)` becomes `epitope_type:Linear AND
// epitope_type:peptide`, matching nothing — so clicking any multi-word facet
// value hung the table at "Showing 0-0 of 0 results" forever. Fix: quote eq()
// values. buildRql() is shared by every resource's FilterBar (genome, strain,
// epitope, surveillance, ...), so this one test on the epitope tab exercises
// the fix for all views — the bug and the fix live in one shared function.
const epitopeGateway = /\/api\/data\/epitope(?:\?|$)/;

function buildEpitopeRows(count: number, epitopeType: string) {
  return Array.from({ length: count }, (_, i) => ({
    epitope_id: String(100000 + i),
    epitope_type: epitopeType,
    epitope_sequence: `SEQ${String(i)}`,
    organism: "Influenza A virus",
    protein_name: "Nucleoprotein",
    total_assays: 1,
    date_inserted: "2021-09-20",
  }));
}

test.describe("taxon collection tabs: local keyword filtering", () => {
  for (const { tab, keyword, rowText, requestPattern, rows } of [
    {
      tab: "genomes",
      keyword: "Middle East",
      rowText: "Middle East respiratory syndrome-related coronavirus isolate",
      requestPattern: /\/api\/data\/genome(?:\?|$)/,
    },
    {
      tab: "features",
      keyword: "replicase",
      rowText: "replicase polyprotein",
      requestPattern: /\/api\/data\/genome_feature(?:\?|$)/,
      rows: [
        {
          feature_id: "feature-1",
          patric_id: "fig|1.1.peg.1",
          genome_id: "1.1",
          genome_name: "Fixture genome",
          feature_type: "CDS",
          product: "replicase polyprotein",
        },
        {
          feature_id: "feature-2",
          patric_id: "fig|1.1.peg.2",
          genome_id: "1.1",
          genome_name: "Fixture genome",
          feature_type: "CDS",
          product: "capsid protein",
        },
      ],
    },
  ]) {
    test(`filters loaded ${tab} rows without changing navbar, URL, or requests`, async ({
      page,
    }) => {
      await applyBackendMocks(page, {
        overrides: [...permissiveBackendOverrides],
      });
      const collectionRequests: string[] = [];
      page.on("request", (request) => {
        const pattern = rows ? genomeFeatureBackend : requestPattern;
        if (pattern.test(request.url())) collectionRequests.push(request.url());
      });
      if (rows) {
        await page.route(genomeFeatureBackend, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body:
              route.request().headers().accept === "application/solr+json"
                ? JSON.stringify({ response: { numFound: rows.length } })
                : JSON.stringify(rows),
          });
        });
      }

      await page.goto(`/taxonomy/${influenzaTaxonId}?tab=${tab}`);
      await expect(page.getByText(rowText).first()).toBeVisible({
        timeout: 10_000,
      });
      const requestCount = collectionRequests.length;

      await page.getByPlaceholder("Search keywords...").fill(keyword);
      await expect(page.getByText(/Showing 1-1 of 1 results/)).toBeVisible();
      await expect(
        page.getByRole("textbox", {
          name: "Search by virus name, protein, gene, or taxonomy...",
        }),
      ).toHaveValue("");
      await expect(page).toHaveURL(
        `/taxonomy/${influenzaTaxonId}?tab=${tab}`,
      );
      expect(collectionRequests).toHaveLength(requestCount);
    });
  }
});

test.describe("taxon epitopes tab: local filtering and facets", () => {
  test("filters loaded rows without changing the navbar search or URL", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [...permissiveBackendOverrides],
    });
    const collectionRequests: string[] = [];
    page.on("request", (request) => {
      if (epitopeGateway.test(request.url()))
        collectionRequests.push(request.url());
    });

    await page.goto(`/taxonomy/${influenzaTaxonId}?tab=epitopes`);
    await expect(page.getByText("Hemagglutinin").first()).toBeVisible({
      timeout: 10_000,
    });
    const requestCount = collectionRequests.length;

    await page.getByPlaceholder("Search keywords...").fill("hemag");
    await expect(page.getByText(/Showing 1-1 of 1 results/)).toBeVisible();
    await expect(
      page.getByRole("textbox", {
        name: "Search by virus name, protein, gene, or taxonomy...",
      }),
    ).toHaveValue("");
    await expect(page).toHaveURL(
      `/taxonomy/${influenzaTaxonId}?tab=epitopes`,
    );
    expect(collectionRequests).toHaveLength(requestCount);
  });

  test("clicking a multi-word Epitope Type facet value returns matching rows, not an empty table", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [...permissiveBackendOverrides],
    });

    // The gateway exposes one combined rows/count/facets response. Only a
    // correctly quoted phrase predicate is treated as a hit so this remains a
    // regression test for typed RQL serialization.
    await page.route(epitopeGateway, async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      const decoded = decodeURIComponent(route.request().url());
      const hasEpitopeTypeEq = decoded.includes("eq(epitope_type,");
      const hasQuotedPhrase = decoded.includes(
        'eq(epitope_type,"Linear%20peptide")',
      );
      const matches = !hasEpitopeTypeEq || hasQuotedPhrase;
      const total = matches ? (hasEpitopeTypeEq ? 3 : 10) : 0;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rows: matches ? buildEpitopeRows(total, "Linear peptide") : [],
          total,
          facets: {
            epitope_type: matches
              ? [
                  { value: "Linear peptide", count: 10 },
                  { value: "Discontinuous peptide", count: 2 },
                ]
              : [],
            protein_name: [],
            host_name: [],
            assay_results: [],
          },
          page: 1,
          pageSize: 200,
        }),
      });
    });

    await page.goto(`/taxonomy/${influenzaTaxonId}?tab=epitopes`);
    await expect(page.getByText("SEQ0")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Show Filters" }).click();
    await page.getByRole("button", { name: /^Linear peptide \(/ }).click();

    // The regression hangs here forever at "Showing 0-0 of 0 results" — assert the
    // real match count instead, proving the request carried a quoted phrase value.
    await expect(page.getByText(/Showing 1-3 of 3 results/)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/Showing 0-0 of 0 results/)).not.toBeVisible();
  });
});
