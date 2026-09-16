import type { Request as PlaywrightRequest } from "@playwright/test";

import { test, expect, applyBackendMocks } from "../../mocks/backends";
import { buildPpiRows, buildPpiOverrides, emptyBackendFallbackOverrides } from "../../fixtures/overrides";
import { TaxonInteractionsPage } from "../../pages";

test.use({ storageState: { cookies: [], origins: [] } });

const INTERACTIONS_TAXON_ID = "234"; // Brucella - lineage includes Bacteria

async function setupInteractionsPage(
  page: Parameters<typeof applyBackendMocks>[0],
  rows = buildPpiRows(3),
) {
  await applyBackendMocks(page, {
    overrides: [...buildPpiOverrides(rows), ...emptyBackendFallbackOverrides],
  });

  const interactionsPage = new TaxonInteractionsPage(page);
  await interactionsPage.goto(INTERACTIONS_TAXON_ID);
  return interactionsPage;
}

test.describe("taxon interactions tab", () => {
  test("renders PPI rows for the bacterial taxon", async ({ page }) => {
    const interactionsPage = await setupInteractionsPage(page);

    await interactionsPage.expectResultCount("Showing 1-3 of 3 results");
    await interactionsPage.expectInteractor("fig|224914.16.peg.600");
    await interactionsPage.expectTab("Interactions");
  });

  test("Graph subtab renders a canvas", async ({ page, browserName }) => {
    // Sigma.js renders into a WebGL canvas and has no software fallback. Headless
    // Firefox in CI cannot create a WebGL context ("Exhausted GL driver options"),
    // so Sigma throws and the canvas never mounts. Chromium and WebKit ship
    // software GL and render it fine. Mirrors viewer-3d.spec.ts, which gates its
    // Mol* WebGL canvas assertion the same way.
    test.skip(browserName === "firefox", "Headless Firefox has no WebGL for Sigma.js to render into");

    const interactionsPage = await setupInteractionsPage(page);

    await interactionsPage.switchToGraph();
    await interactionsPage.expectCanvasVisible();
  });

  test("Graph subtab preserves the workspace when there are no interactions", async ({ page }) => {
    const interactionsPage = await setupInteractionsPage(page, []);

    await interactionsPage.switchToGraph();
    await interactionsPage.expectEmptyGraphWorkspace();
  });

  test("layout dropdown shows the human-readable label, not the raw value", async ({ page, browserName }) => {
    // The action bar (and its layout Select) only mount once the graph has nodes,
    // which mounts SigmaCanvas — no WebGL in headless Firefox.
    test.skip(browserName === "firefox", "Headless Firefox has no WebGL for Sigma.js to render into");

    const interactionsPage = await setupInteractionsPage(page);
    await interactionsPage.switchToGraph();

    // Default layout is forceatlas2; the trigger must read "Force Atlas 2".
    await interactionsPage.expectLayoutLabel("Force Atlas 2");

    // Picking another option updates the trigger to that option's label.
    await interactionsPage.selectLayout("Circular");
    await interactionsPage.expectLayoutLabel("Circular");
  });

  test("selecting a node then an incident edge shows the detail panel headers", async ({ page, browserName }) => {
    test.skip(browserName === "firefox", "Headless Firefox has no WebGL for Sigma.js to render into");

    const interactionsPage = await setupInteractionsPage(page);
    await interactionsPage.switchToGraph();

    // buildPpiRows leaves gene blank, so nodes label by interactor id. Row 0
    // links peg.600 ↔ peg.2400, so selecting peg.600 yields one incident edge.
    await interactionsPage.selectNodeInList("fig|224914.16.peg.600");
    await interactionsPage.expectDetailText("BRC ID");
    await interactionsPage.expectDetailText("Interactions (1)");

    // Clicking that incident edge swaps the panel to the edge view with its header.
    await interactionsPage.selectFirstIncidentEdge();
    await interactionsPage.expectDetailText("Interaction");
    await interactionsPage.expectDetailText("Detection method");
  });
});

// ─── Keyword sync between Table and Graph subviews ───────────────────────────
// Regression: filter state lived only inside ListData (src/components/services/
// list-data.tsx), local to the Table subview. Switching to Graph never saw it
// (bug #1). Root cause of bug #3 runs deeper than a missing prop: FilterBar
// (src/components/filterbar/filter-bar.tsx) owns its own keywords/selected
// state and unconditionally re-emits an empty RQL on mount, so even a filter
// value fed back down as a controlled prop gets stomped the instant the
// subtree remounts — and base-ui's Tabs.Panel unmounts inactive panels by
// default (keepMounted: false), remounting Table's FilterBar on every
// switch-back. Fix: `keepMounted` on the Table panel only (interactions-
// subview-shell.tsx) so Table's own state survives untouched, with the shell
// owning the one keyword both views edit.
//
// The shared keyword is now a *request* predicate on both sides: the shell
// hands the same `rql` and keyword text to the Table's collection request and
// to the Graph's bulk-row request, both through the Data API gateway. It used
// to filter only the Table's loaded 200-row page while running a real backend
// query for the Graph, so one input could stand for two datasets. This spec
// exercises the real cross-tab DOM mount/unmount and actual FilterBar remount
// behavior that jsdom unit tests can't faithfully reproduce.
test.describe("taxon interactions tab: filter sync between Table and Graph", () => {
  // Second row's interactor differs from the first (fig|224914.16.peg.600 vs .601) —
  // filtering to "peg.600" narrows from all rows to exactly one, giving an
  // observable row/node-count delta instead of an all-or-nothing assertion.
  const rows = buildPpiRows(2);

  // Match independently of origin because NEXT_PUBLIC_DATA_API is embedded at build
  // time and may point at either the loopback mock or the public API in a local build.
  const ppiRequest = /(?:\/ppi\/|\/api\/data\/ppi(?:\?|$))/;

  // buildPpiOverrides (used by the describe block above) always returns the
  // full row set regardless of query — it can't prove filtering actually
  // narrows anything. This route reads the keyword out of whichever request
  // carries it and serves only rows whose serialized fields contain that text,
  // so the same mock validates bugs #1, #2, and #3 regardless of which UI
  // element wrote the keyword. Mirrors the query-aware epitope-facet mock in
  // taxon-list-data.spec.ts.
  //
  // Both views reach the gateway at /api/data/ppi: the Table with a collection
  // GET whose `keyword` is a query parameter, the Graph with a bulk-row POST
  // whose `keyword` is a body field. Reading them apart is the point — a
  // regression that puts one view back on its own predicate shows up as one of
  // the two requests missing the keyword entirely.
  function keywordFrom(request: PlaywrightRequest): string | undefined {
    const url = new URL(request.url());
    if (url.pathname === "/api/data/ppi") {
      if (request.method() === "POST") {
        const body = request.postDataJSON() as { keyword?: string } | null;
        return body?.keyword;
      }
      return url.searchParams.get("keyword") ?? undefined;
    }
    // Upstream RQL keeps the legacy keyword(<text>*) clause shape.
    return /keyword\(([^*)]+)\*?\)/.exec(decodeURIComponent(request.url()))?.[1];
  }

  async function setupFilterableInteractionsPage(
    page: Parameters<typeof applyBackendMocks>[0],
  ): Promise<TaxonInteractionsPage> {
    await applyBackendMocks(page, { overrides: [...emptyBackendFallbackOverrides] });

    await page.route(ppiRequest, async (route) => {
      const request = route.request();
      const isGatewayRequest = new URL(request.url()).pathname === "/api/data/ppi";
      if (!isGatewayRequest && request.method() !== "GET") return route.fallback();
      const keyword = keywordFrom(request);
      const matchingRows = keyword ? rows.filter((r) => JSON.stringify(r).includes(keyword)) : rows;

      if (isGatewayRequest) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            request.method() === "POST"
              ? { rows: matchingRows }
              : {
                  rows: matchingRows,
                  total: matchingRows.length,
                  facets: {},
                  page: 1,
                  pageSize: 200,
                },
          ),
        });
        return;
      }

      if (decodeURIComponent(request.url()).includes("limit(1)")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ response: { numFound: matchingRows.length } }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(matchingRows),
      });
    });

    const interactionsPage = new TaxonInteractionsPage(page);
    await interactionsPage.goto(INTERACTIONS_TAXON_ID);
    return interactionsPage;
  }

  test("filtering the table narrows the graph to the same subset (bug #1)", async ({ page, browserName }) => {
    test.skip(browserName === "firefox", "Headless Firefox has no WebGL for Sigma.js to render into");

    const interactionsPage = await setupFilterableInteractionsPage(page);

    await interactionsPage.filterByKeyword("peg.600");
    await interactionsPage.expectResultCount("Showing 1-1 of 1 results");

    await interactionsPage.switchToGraph();
    await interactionsPage.expectGraphKeywordValue("peg.600");
    await interactionsPage.expectCanvasVisible();

    const graphPanel = page.getByRole("tabpanel", { name: "Graph" });
    await expect(graphPanel.getByText("fig|224914.16.peg.600")).toBeVisible();
    await expect(graphPanel.getByText("fig|224914.16.peg.601")).not.toBeVisible();
  });

  test("switching Table to Graph and back keeps the table filter applied (bug #3)", async ({ page, browserName }) => {
    // Switching to Graph mounts SigmaCanvas, which headless Firefox can't give a
    // WebGL context — Sigma throws and takes the whole page down (no canvas
    // fallback; see the Graph subtab test above). Table↔Graph state survival is
    // covered on Chromium/WebKit, which ship software GL.
    test.skip(browserName === "firefox", "Headless Firefox has no WebGL for Sigma.js to render into");

    const interactionsPage = await setupFilterableInteractionsPage(page);

    await interactionsPage.filterByKeyword("peg.600");
    await interactionsPage.expectResultCount("Showing 1-1 of 1 results");

    await interactionsPage.switchToGraph();
    await interactionsPage.switchToTable();

    await interactionsPage.expectTableKeywordValue("peg.600");
    await interactionsPage.expectResultCount("Showing 1-1 of 1 results");
  });

  test("editing the shared keyword in Graph updates Graph and Table results (bug #2)", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "firefox", "Headless Firefox has no WebGL for Sigma.js to render into");

    const interactionsPage = await setupFilterableInteractionsPage(page);

    await interactionsPage.switchToGraph();
    await interactionsPage.expectCanvasVisible();

    const graphPanel = page.getByRole("tabpanel", { name: "Graph" });
    await expect(graphPanel.getByText("fig|224914.16.peg.600")).toBeVisible();
    await expect(graphPanel.getByText("fig|224914.16.peg.601")).toBeVisible();

    await interactionsPage.filterGraphByKeyword("peg.600");

    await expect(graphPanel.getByText("fig|224914.16.peg.600")).toBeVisible();
    await expect(graphPanel.getByText("fig|224914.16.peg.601")).not.toBeVisible();

    await interactionsPage.switchToTable();
    await interactionsPage.expectTableKeywordValue("peg.600");
    await interactionsPage.expectResultCount("Showing 1-1 of 1 results");
  });
});
