import { test, expect, applyBackendMocks } from "../../mocks/backends";
import {
  buildPpiRows,
  buildPpiOverrides,
  emptyBackendFallbackOverrides,
} from "../../fixtures/overrides";
import { TaxonInteractionsPage } from "../../pages";

test.use({ storageState: { cookies: [], origins: [] } });

const INTERACTIONS_TAXON_ID = "234";

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
    // Headless Firefox in CI cannot create a WebGL context, so Sigma throws and the
    // canvas never mounts; Chromium and WebKit ship software GL.
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

    await interactionsPage.selectNodeInList("fig|224914.16.peg.600");
    await interactionsPage.expectDetailText("BRC ID");
    await interactionsPage.expectDetailText("Interactions (1)");

    await interactionsPage.selectFirstIncidentEdge();
    await interactionsPage.expectDetailText("Interaction");
    await interactionsPage.expectDetailText("Detection method");
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
    await expect(graphPanel.getByText("fig|224914.16.peg.600")).toBeVisible();
    await expect(
      graphPanel.getByText("fig|224914.16.peg.601"),
    ).not.toBeVisible();
  });

  test("switching Table to Graph and back keeps the table filter applied (bug #3)", async ({
    page,
    browserName,
  }) => {
    // Switching to Graph mounts SigmaCanvas, which headless Firefox cannot give a WebGL
    // context; Chromium and WebKit cover this.
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
    await expect(graphPanel.getByText("fig|224914.16.peg.600")).toBeVisible();
    await expect(graphPanel.getByText("fig|224914.16.peg.601")).toBeVisible();

    await interactionsPage.filterGraphByKeyword("peg.600");

    await expect(graphPanel.getByText("fig|224914.16.peg.600")).toBeVisible();
    await expect(
      graphPanel.getByText("fig|224914.16.peg.601"),
    ).not.toBeVisible();

    await interactionsPage.switchToTable();
    await interactionsPage.expectTableKeywordValue("peg.600");
    await interactionsPage.expectResultCount("Showing 1-1 of 1 results");
  });
});
