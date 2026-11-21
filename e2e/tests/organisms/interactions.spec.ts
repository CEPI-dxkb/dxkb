import { test, expect, applyBackendMocks } from "../../mocks/backends";
import {
  buildPpiRows,
  buildPpiOverrides,
  emptyBackendFallbackOverrides,
} from "../../fixtures/overrides";
import { TaxonInteractionsPage } from "../../pages";

test.use({ storageState: { cookies: [], origins: [] } });

const INTERACTIONS_TAXON_ID = "234";

// The Graph names a protein by its gene, else its locus tag. The fixture rows have no gene and give
// the interactor `fig|224914.16.peg.<600 + n>` the locus tag `BAWG_<1000 + n>`.
const peg600Label = "BAWG_1000";
const peg601Label = "BAWG_1001";
const peg602Label = "BAWG_1002";

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
    // Headless Firefox in CI cannot create a WebGL 2 context, so the Graph shows its
    // "needs WebGL 2" notice (`supportsWebGl2()`) and the canvas never mounts; Chromium
    // and WebKit ship software GL.
    test.skip(
      browserName === "firefox",
      "Headless Firefox has no WebGL for Sigma.js to render into",
    );

    const interactionsPage = await setupInteractionsPage(page);

    await interactionsPage.switchToGraph();
    await interactionsPage.expectCanvasVisible();
  });

  test("Graph lays out in a Web Worker, not on the main thread", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === "firefox",
      "Headless Firefox has no WebGL for Sigma.js to render into",
    );

    // jsdom has no Worker, so only a browser shows the layout leaving the main thread.
    const workerUrls: string[] = [];
    const fallbackWarnings: string[] = [];
    page.on("worker", (worker) => {
      workerUrls.push(worker.url());
    });
    page.on("console", (message) => {
      if (message.text().includes("laying out on the main thread")) {
        fallbackWarnings.push(message.text());
      }
    });

    const interactionsPage = await setupInteractionsPage(page);
    await interactionsPage.switchToGraph();
    await interactionsPage.expectCanvasVisible();
    await interactionsPage.waitForLayout();
    await interactionsPage.expectNoLayoutError();

    expect(workerUrls.length).toBeGreaterThan(0);
    expect(fallbackWarnings).toEqual([]);
  });

  test("Graph subtab preserves the workspace when there are no interactions", async ({
    page,
  }) => {
    const interactionsPage = await setupInteractionsPage(page, []);

    await interactionsPage.switchToGraph();
    await interactionsPage.expectEmptyGraphWorkspace();
  });

  test("layout dropdown shows the human-readable label, not the raw value", async ({
    page,
    browserName,
  }) => {
    // The action bar mounts only once the graph has nodes (SigmaCanvas), which needs
    // WebGL.
    test.skip(
      browserName === "firefox",
      "Headless Firefox has no WebGL for Sigma.js to render into",
    );

    const interactionsPage = await setupInteractionsPage(page);
    await interactionsPage.switchToGraph();

    await interactionsPage.expectLayoutLabel("Force Atlas 2");

    await interactionsPage.selectLayout("Circular");
    await interactionsPage.expectLayoutLabel("Circular");
  });

  test("selecting a node then an incident edge shows the detail panel headers", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === "firefox",
      "Headless Firefox has no WebGL for Sigma.js to render into",
    );

    const interactionsPage = await setupInteractionsPage(page);
    await interactionsPage.switchToGraph();

    await interactionsPage.selectNodeInList(peg600Label);
    await interactionsPage.openIdentifiers();
    await interactionsPage.expectDetailText("BRC ID");
    await interactionsPage.expectDetailText("Interactions (1)");
    await interactionsPage.expectDetailLink(
      "fig|224914.16.peg.600",
      "/feature/PATRIC.224914.16.feature-a-0",
    );

    await interactionsPage.selectFirstIncidentEdge();
    await interactionsPage.expectDetailText("Interaction");
    await interactionsPage.expectDetailText("Detection method");
  });

  test("Cmd/Ctrl-clicking nodes in the list builds a multi-selection", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === "firefox",
      "Headless Firefox has no WebGL for Sigma.js to render into",
    );

    const interactionsPage = await setupInteractionsPage(page);
    await interactionsPage.switchToGraph();

    await interactionsPage.selectNodeInList(peg600Label);
    await interactionsPage.addNodeToSelectionInList(peg601Label);

    await interactionsPage.expectDetailText("Multiple selection");
    await interactionsPage.expectDetailText(
      "2 proteins and 0 interactions selected.",
    );
    await expect(page).not.toHaveURL(/interactionsGraph\.node=/);
  });
});

test.describe("taxon interactions tab: Back from a linked page", () => {
  test("Back from a node's feature page restores the Graph subview, the selected node and the zoom", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === "firefox",
      "Headless Firefox has no WebGL for Sigma.js to render into",
    );

    const interactionsPage = await setupInteractionsPage(page);
    await interactionsPage.switchToGraph();
    await interactionsPage.waitForLayout();
    const zoomPercent = await interactionsPage.zoomIn();
    expect(zoomPercent).not.toBe("100");
    await interactionsPage.selectNodeInList(peg600Label);
    await interactionsPage.expectNodeSelected(peg600Label);

    await interactionsPage.followDetailLink(
      "fig|224914.16.peg.600",
      "/feature/PATRIC.224914.16.feature-a-0",
    );
    await interactionsPage.goBack();

    await expect(page).toHaveURL(/interactionsGraph\.view=graph/);
    await interactionsPage.expectGraphActive();
    await interactionsPage.expectNodeSelected(peg600Label);
    await interactionsPage.expectZoomPercent(zoomPercent);
  });
});

test.describe("taxon interactions tab: filter sync between Table and Graph", () => {
  const rows = buildPpiRows(2);

  async function setupFilterableInteractionsPage(
    page: Parameters<typeof applyBackendMocks>[0],
  ): Promise<TaxonInteractionsPage> {
    await applyBackendMocks(page, {
      overrides: [...buildPpiOverrides(rows), ...emptyBackendFallbackOverrides],
    });

    const interactionsPage = new TaxonInteractionsPage(page);
    await interactionsPage.goto(INTERACTIONS_TAXON_ID);
    return interactionsPage;
  }

  test("filtering the table narrows the graph to the same subset (bug #1)", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === "firefox",
      "Headless Firefox has no WebGL for Sigma.js to render into",
    );

    const interactionsPage = await setupFilterableInteractionsPage(page);

    await interactionsPage.filterByKeyword("peg.600");
    await interactionsPage.expectResultCount("Showing 1-1 of 1 results");

    await interactionsPage.switchToGraph();
    await interactionsPage.expectGraphKeywordValue("peg.600");
    await interactionsPage.expectCanvasVisible();

    const graphPanel = page.getByRole("tabpanel", { name: "Graph" });
    await expect(graphPanel.getByText(peg600Label)).toBeVisible();
    await expect(graphPanel.getByText(peg601Label)).not.toBeVisible();
  });

  test("switching Table to Graph and back keeps the table filter applied (bug #3)", async ({
    page,
    browserName,
  }) => {
    // Switching to Graph mounts SigmaCanvas, which headless Firefox cannot give a WebGL 2
    // context, so it shows the "needs WebGL 2" notice instead; Chromium and WebKit cover
    // this.
    test.skip(
      browserName === "firefox",
      "Headless Firefox has no WebGL for Sigma.js to render into",
    );

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
    test.skip(
      browserName === "firefox",
      "Headless Firefox has no WebGL for Sigma.js to render into",
    );

    const interactionsPage = await setupFilterableInteractionsPage(page);

    await interactionsPage.switchToGraph();
    await interactionsPage.expectCanvasVisible();

    const graphPanel = page.getByRole("tabpanel", { name: "Graph" });
    await expect(graphPanel.getByText(peg600Label)).toBeVisible();
    await expect(graphPanel.getByText(peg601Label)).toBeVisible();

    await interactionsPage.filterGraphByKeyword("peg.600");

    await expect(graphPanel.getByText(peg600Label)).toBeVisible();
    await expect(graphPanel.getByText(peg601Label)).not.toBeVisible();

    await interactionsPage.switchToTable();
    await interactionsPage.expectTableKeywordValue("peg.600");
    await interactionsPage.expectResultCount("Showing 1-1 of 1 results");
  });
});

test.describe("taxon interactions tab: narrowing a graph", () => {
  const sigmaSkip = "Headless Firefox has no WebGL for Sigma.js to render into";

  test("a truncated graph says how to narrow it, and its filter and focus picks reach the Table", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "firefox", sigmaSkip);
    // Every pick re-reads the 10,000 rows (the mock ignores `rql`) and starts a new layout, which the
    // next step does not wait for; CI runners (2 workers, software WebGL) were still mid-test at the
    // default 30 s even at 5,000, so the headroom stays.
    test.slow();

    // One row past the Graph's 10,000 (`interactionsGraphRowLimit`): the mock answers the export
    // with the 10,000 rows it asked for and the full count of 10,001, as the gateway passes on the
    // Data API's `Content-Range` total, so the Graph flags the cut and names the count.
    const interactionsPage = await setupInteractionsPage(
      page,
      buildPpiRows(10_001),
    );
    await interactionsPage.switchToGraph();
    await interactionsPage.expectTruncationNotice(10_001);
    await interactionsPage.expectTruncationReason();

    // The mock ignores `rql`, so the picks are asserted as shared state (URL, pills), not as
    // fewer rows.
    await interactionsPage.pickFilter("Interaction Type", "predicted interaction");
    await interactionsPage.expectUrlFilter(
      "interaction_type",
      "predicted interaction",
    );
    await interactionsPage.expectFilterActive("Interaction Type");

    const focusId = "fig|224914.16.peg.600";
    await interactionsPage.selectNodeInList(peg600Label, true);
    await interactionsPage.focusSelectedNode();
    await interactionsPage.expectUrlFilter("interactor", focusId);
    await interactionsPage.expectFilterActive("Protein");

    // The Table reads the same URL state, so both picks are active there too.
    await interactionsPage.switchToTable();
    await interactionsPage.expectFilterActive("Interaction Type");
    await interactionsPage.expectFilterActive("Protein");
  });

  test("Show in Graph draws the selected Table rows alone, until Show all", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "firefox", sigmaSkip);

    const interactionsPage = await setupInteractionsPage(page, buildPpiRows(3));
    await interactionsPage.expectResultCount("Showing 1-3 of 3 results");

    await interactionsPage.selectTableRows("ppi-0000", "ppi-0001");
    await interactionsPage.showSelectedRowsInGraph();

    // The mock serves the `selected` read by id, so this one can show the narrowing.
    await interactionsPage.expectSelectionChip(2);
    await interactionsPage.expectGraphFilterBar(false);
    await interactionsPage.expectGraphNode(peg601Label, true);
    await interactionsPage.expectGraphNode(peg602Label, false);

    await interactionsPage.showAll();

    await interactionsPage.expectGraphFilterBar(true);
    await interactionsPage.expectGraphNode(peg602Label, true);
  });
});

// The only checks that read what the canvas painted. Highlighting can vanish without an error, a
// unit test or any DOM assertion noticing (the list still marks the row selected and the details
// pane still opens), so these count pixels of the colors `graph-theme.ts` gives a node. Each is an
// exact, opaque swatch that a dimmed (translucent grey) node or an anti-aliased edge cannot reach.
test.describe("taxon interactions tab: canvas pixels", () => {
  // `colors.microbial` (#90CAF9) and `colors.selected` (#FFAB00).
  const microbialBlue = [144, 202, 249] as const;
  const selectedOrange = [255, 171, 0] as const;
  // Each read is a screenshot, and a node is only a few pixels across, so the poll gets room on a
  // slow runner.
  const pixelPoll = { timeout: 15_000 };

  test.skip(
    ({ browserName }) => browserName === "firefox",
    "Headless Firefox has no WebGL for Sigma.js to render into",
  );

  // Three rows are three disjoint pairs of microbial nodes (`fig|...peg.600` with `peg.2400`, and
  // so on), so selecting one node leaves two pairs that are not its neighbors. The layout is
  // seeded, so the pairs land in the same places on every run: peg.601's pair sits in the top-left,
  // well clear of the Controls button and the zoom control that the screenshots mask.
  const selectedLabel = peg601Label;

  async function openDrawnGraph(page: Parameters<typeof applyBackendMocks>[0]) {
    const interactionsPage = await setupInteractionsPage(page, buildPpiRows(3));
    await interactionsPage.switchToGraph();
    await interactionsPage.expectCanvasVisible();
    // The canvas is drawn once the nodes' blue is on it, so a later "no orange" is not just an
    // empty canvas.
    await expect
      .poll(() => interactionsPage.canvasColorCount(microbialBlue), pixelPoll)
      .toBeGreaterThan(0);
    return interactionsPage;
  }

  test("the default graph draws its nodes, none of them selected", async ({
    page,
  }) => {
    const interactionsPage = await openDrawnGraph(page);

    expect(await interactionsPage.canvasColorCount(selectedOrange)).toBe(0);
  });

  test("selecting a protein paints it in the selection color, and clearing the selection takes it back", async ({
    page,
  }) => {
    const interactionsPage = await openDrawnGraph(page);
    expect(await interactionsPage.canvasColorCount(selectedOrange)).toBe(0);
    const blueBefore = await interactionsPage.canvasColorCount(microbialBlue);

    await interactionsPage.selectNodeInList(selectedLabel);
    await interactionsPage.expectNodeSelected(selectedLabel);
    await expect
      .poll(() => interactionsPage.canvasColorCount(selectedOrange), pixelPoll)
      .toBeGreaterThan(0);

    await interactionsPage.removeNodeFromSelectionInList(selectedLabel);
    await expect
      .poll(() => interactionsPage.canvasColorCount(selectedOrange), pixelPoll)
      .toBe(0);
    // "No orange" alone would also hold for a blank canvas: the nodes are back in their blue.
    await expect
      .poll(() => interactionsPage.canvasColorCount(microbialBlue), pixelPoll)
      .toBeGreaterThanOrEqual(Math.floor(blueBefore * 0.9));
  });

  test("selecting a protein dims the nodes that are not its neighbors", async ({
    page,
  }) => {
    const interactionsPage = await openDrawnGraph(page);
    const blueBefore = await interactionsPage.canvasColorCount(microbialBlue);

    await interactionsPage.selectNodeInList(selectedLabel);
    await interactionsPage.expectNodeSelected(selectedLabel);

    // The selected node turns orange and its one partner keeps its blue; the other two pairs go
    // translucent grey. Five of the six nodes lose their blue, so the count falls well under half
    // (Chromium 67 -> ~12 pixels, WebKit 245 -> ~41). Merely "fewer" would also pass when only the
    // selected node turned orange and nothing dimmed, and the partner's remaining blue rules out a
    // blank canvas.
    await expect
      .poll(() => interactionsPage.canvasColorCount(microbialBlue), pixelPoll)
      .toBeLessThan(Math.floor(blueBefore / 2));
    expect(await interactionsPage.canvasColorCount(microbialBlue)).toBeGreaterThan(
      0,
    );
  });
});
