import { applyBackendMocks, expect, test } from "../mocks/backends";
import {
  compareRegionScenarioOverrides,
  emptyBackendFallbackOverrides,
  genomeFeatureScenarioOverrides,
} from "../fixtures/overrides";
import { CompareRegionPage } from "../pages";
import { failOnRuntimeErrors } from "../support/runtime-errors";

/**
 * The fixture feature: a CDS with a BRC ID (`fig|1282460.2049.peg.1`), so its
 * Compare Region tab is enabled. The tab's answer is the ten-genome fixture
 * (`compareRegionScenarioOverrides`), whose focus gene is
 * `fig|1004954.3.peg.1`: row 0's first feature, in a family that runs through
 * every row.
 */
const featureId = "PATRIC.1282460.2049.JX869059.CDS.1.100.fwd";
const focusGene = "fig|1004954.3.peg.1";

const overrides = [
  ...compareRegionScenarioOverrides,
  ...genomeFeatureScenarioOverrides,
  ...emptyBackendFallbackOverrides,
];

// Signed out, as every record-view spec runs: signed in, the Feature page reads
// its record with the session token, which the data service client refuses to
// send to the loopback's plain-http URL ("Authenticated data service requests
// require HTTPS."), so the page would render its error panel instead.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Compare Region Viewer", () => {
  let assertNoRuntimeErrors: () => void;

  test.beforeEach(async ({ page }) => {
    assertNoRuntimeErrors = failOnRuntimeErrors(page);
    await applyBackendMocks(page, { overrides: [...overrides] });
  });

  test.afterEach(() => {
    assertNoRuntimeErrors();
  });

  test("the figure draws every genome and zooms from 1× to 20×", async ({
    page,
  }) => {
    const compare = new CompareRegionPage(page);
    const request = page.waitForRequest(
      (candidate) =>
        new URL(candidate.url()).pathname === "/api/compare-region",
    );
    await compare.goto(featureId);
    // The tab asks about the feature's BRC ID.
    expect(new URL((await request).url()).searchParams.get("peg")).toBe(
      "fig|1282460.2049.peg.1",
    );
    await compare.expectFigure(10);

    await expect(compare.zoomLevel).toHaveText("1.0×");
    await expect(compare.zoomOut).toBeDisabled();
    await expect(compare.fit).toBeDisabled();

    // Zoom in disables at the cap, 20×.
    await compare.zoomInToLimit();
    await expect(compare.zoomLevel).toHaveText("20×");
    await expect(compare.zoomIn).toBeDisabled();
    await expect(compare.zoomOut).toBeEnabled();

    await compare.fit.click();
    await expect(compare.zoomLevel).toHaveText("1.0×");
    await expect(compare.zoomOut).toBeDisabled();
    await expect(compare.zoomIn).toBeEnabled();
  });

  test("Compact draws the figure shorter at the same zoom, and a reload keeps it", async ({
    page,
  }) => {
    const compare = new CompareRegionPage(page);
    await compare.goto(featureId);
    await compare.expectFigure(10);
    await expect(compare.densityOption("Comfortable")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const level = await compare.zoomInBy(2);
    expect(level).toBe("2.3×");
    const comfortable = await compare.figureHeight();

    await compare.chooseDensity("Compact");
    await expect(compare.densityOption("Comfortable")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect.poll(() => compare.figureHeight()).toBeLessThan(comfortable);
    await expect(compare.zoomLevel).toHaveText(level);
    await compare.expectFigure(10);
    const compact = await compare.figureHeight();

    // A device preference the server renders: a reload opens in Compact.
    await page.reload();
    await compare.expectFigure(10);
    await expect(compare.densityOption("Compact")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await compare.figureHeight()).toBe(compact);
  });

  test("hovering a gene opens its tooltip and traces its family", async ({
    page,
  }) => {
    const compare = new CompareRegionPage(page);
    await compare.goto(featureId);
    await compare.expectFigure(10);
    await expect(compare.tooltip).toHaveCount(0);
    await expect(compare.traceVeil()).toHaveCSS("opacity", "0");

    await compare.glyph(0, 0).hover();
    await expect(compare.tooltip).toBeVisible();
    await expect(compare.tooltip).toContainText(focusGene);
    await expect(compare.tooltip).toContainText("SSU ribosomal protein S4p");
    await expect(compare.traceVeil()).toHaveCSS("opacity", "0.8");

    // Off the figure, the tooltip and the trace go.
    await page.mouse.move(0, 0);
    await expect(compare.tooltip).toHaveCount(0);
    await expect(compare.traceVeil()).toHaveCSS("opacity", "0");
  });

  test("clicking a gene pins it in the selection strip", async ({ page }) => {
    const compare = new CompareRegionPage(page);
    await compare.goto(featureId);
    await compare.expectFigure(10);
    await expect(compare.openFeature).toHaveCount(0);

    await compare.glyph(0, 0).click();
    await expect(compare.openFeature).toBeVisible();
    await expect(compare.openFeature).toHaveAttribute(
      "href",
      "/feature/fig%7C1004954.3.peg.1",
    );

    await compare.clearSelection.click();
    await expect(compare.openFeature).toHaveCount(0);
  });

  test("signed out, the workspace group sources are disabled, with a sign-in hint", async ({
    page,
  }) => {
    const compare = new CompareRegionPage(page);
    await compare.goto(featureId);
    await compare.expectFigure(10);
    await expect(compare.genomesMenu).toHaveAccessibleName(
      "Genomes: Reference & representative",
    );

    const menu = await compare.openGenomesMenu();
    await expect(compare.source("Reference & representative")).toBeChecked();
    await expect(compare.source("All genomes")).toBeEnabled();
    await expect(compare.source("Selected genome group")).toBeDisabled();
    await expect(compare.source("Selected feature group")).toBeDisabled();
    await expect(
      menu.getByText("Sign in to use your workspace groups"),
    ).toBeVisible();
  });
});
