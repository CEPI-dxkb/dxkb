import { applyBackendMocks, expect, test } from "../mocks/backends";
import {
  compareRegionScenarioOverrides,
  emptyBackendFallbackOverrides,
  genomeFeatureScenarioOverrides,
} from "../fixtures/overrides";
import { CompareRegionPage } from "../pages";
import { attachFocusTrail, recordFocusTrail } from "../support/focus-trail";
import { failOnRuntimeErrors } from "../support/runtime-errors";

/**
 * The fixture feature: a CDS with a BRC ID so its Compare Region tab is enabled; the
 * focus gene is `fig|1004954.3.peg.1`.
 */
const featureId = "PATRIC.1282460.2049.JX869059.CDS.1.100.fwd";
const focusGene = "fig|1004954.3.peg.1";

const overrides = [
  ...compareRegionScenarioOverrides,
  ...genomeFeatureScenarioOverrides,
  ...emptyBackendFallbackOverrides,
];

// Signed out: signed in, the data service client refuses to send the token to the
// loopback's plain-http URL.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Compare Region Viewer", () => {
  let assertNoRuntimeErrors: () => void;

  test.beforeEach(async ({ page }) => {
    assertNoRuntimeErrors = failOnRuntimeErrors(page);
    await recordFocusTrail(page);
    await applyBackendMocks(page, { overrides: [...overrides] });
  });

  test.afterEach(async ({ page }, testInfo) => {
    await attachFocusTrail(page, testInfo);
    try {
      assertNoRuntimeErrors();
    } catch (error) {
      if (testInfo.status === testInfo.expectedStatus) {
        await attachFocusTrail(page, testInfo, { force: true });
      }
      throw error;
    }
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
    expect(new URL((await request).url()).searchParams.get("peg")).toBe(
      "fig|1282460.2049.peg.1",
    );
    await compare.expectFigure(10);

    await expect(compare.zoomLevel).toHaveText("1.0×");
    await expect(compare.zoomOut).toBeDisabled();
    await expect(compare.fit).toBeDisabled();

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
    await expect(compare.densityToggle("Compact")).toBeVisible();
    const level = await compare.zoomInBy(2);
    expect(level).toBe("2.3×");
    const comfortable = await compare.figureHeight();

    await compare.chooseDensity("Compact");
    await expect(compare.densityToggle("Compact")).toHaveCount(0);
    await expect.poll(() => compare.figureHeight()).toBeLessThan(comfortable);
    await expect(compare.zoomLevel).toHaveText(level);
    await compare.expectFigure(10);
    const compact = await compare.figureHeight();

    await page.reload();
    await compare.expectFigure(10);
    await expect(compare.densityToggle("Comfortable")).toBeVisible();
    expect(await compare.figureHeight()).toBe(compact);
  });

  test("a drag slides the figure, and draws it where it stands on release", async ({
    page,
  }) => {
    const compare = new CompareRegionPage(page);
    await compare.goto(featureId);
    await compare.expectFigure(10);
    await compare.zoomInBy(2);
    const gene = compare.glyph(0, 0);
    const box = async () => {
      const found = await gene.boundingBox();
      if (!found) throw new Error("the focus gene is not drawn");
      return found;
    };
    const start = await box();
    const x = start.x + start.width / 2;
    const y = start.y + start.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 10, y);
    // Zoom's move handler reads isDragging from its last render; a loaded runner can
    // deliver the next move before the drag start is drawn, dropping it.
    await expect(compare.dragging).toHaveCount(1);
    await page.mouse.move(x - 110, y);
    const slide = /^translate\(-(\d+(\.\d+)?) 0\)$/;
    await expect(compare.panLayers).toHaveCount(2);
    await expect(compare.panLayers.first()).toHaveAttribute("transform", slide);
    await expect.poll(async () => (await box()).x).toBeCloseTo(start.x - 100, 0);
    await page.mouse.move(x - 210, y);
    await expect.poll(async () => (await box()).x).toBeCloseTo(start.x - 200, 0);

    await page.mouse.up();
    await expect(compare.panLayers.first()).not.toHaveAttribute("transform");
    expect((await box()).x).toBeCloseTo(start.x - 200, 0);
    await expect(compare.featureCard).toHaveCount(0);
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

    await compare.glyph(0, 3).hover();
    await expect(compare.tooltip).toContainText("RNA binding S1 domain protein");
    await expect(compare.traceVeil()).toHaveCSS("opacity", "0.8");
    await expect(compare.traceSlots().filter({ has: page.locator("*") })).toHaveCount(1);

    await page.mouse.move(0, 0);
    await expect(compare.tooltip).toHaveCount(0);
    await expect(compare.traceVeil()).toHaveCSS("opacity", "0");
  });

  test("the tooltip hangs below and right of its gene, or left and above it near the edges", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const compare = new CompareRegionPage(page);
    await compare.goto(featureId);
    await compare.expectFigure(10);
    /** The gene's and the tooltip's boxes once it hovers the gene. */
    const hover = async (row: number, feature: number) => {
      const gene = compare.glyph(row, feature);
      await gene.hover();
      await expect(compare.tooltip).toBeVisible();
      const geneBox = await gene.boundingBox();
      const tipBox = await compare.tooltip.boundingBox();
      if (!geneBox || !tipBox) throw new Error("no gene or tooltip box");
      return {
        gene: {
          left: geneBox.x,
          right: geneBox.x + geneBox.width,
          top: geneBox.y,
          bottom: geneBox.y + geneBox.height,
        },
        tip: {
          left: tipBox.x,
          right: tipBox.x + tipBox.width,
          top: tipBox.y,
          bottom: tipBox.y + tipBox.height,
        },
      };
    };
    /** `value` is a few px past `edge`, on its `way` side (1 after it, -1 before it). */
    const justPast = (value: number, edge: number, way: 1 | -1) => {
      const past = (value - edge) * way;
      expect(past).toBeGreaterThanOrEqual(0);
      expect(past).toBeLessThanOrEqual(10);
    };

    const roomy = await hover(2, 1);
    justPast(roomy.tip.left, roomy.gene.right, 1);
    justPast(roomy.tip.top, roomy.gene.bottom, 1);

    const atRight = await hover(0, 6);
    justPast(atRight.tip.right, atRight.gene.left, -1);
    justPast(atRight.tip.top, atRight.gene.bottom, 1);

    const atBottom = await hover(9, 4);
    justPast(atBottom.tip.bottom, atBottom.gene.top, -1);
  });

  test("clicking a gene pins its tooltip as a card, expanded with its record", async ({
    page,
  }) => {
    const compare = new CompareRegionPage(page);
    await compare.goto(featureId);
    await compare.expectFigure(10);
    await expect(compare.openFeature).toHaveCount(0);

    const gene = compare.glyph(0, 0);
    await gene.hover();
    await expect(compare.tooltip).toContainText(focusGene);
    await gene.click();
    const card = compare.featureCard;
    await expect(card).toBeVisible();
    await expect(card).toContainText(focusGene);
    await expect(compare.tooltip).toHaveCount(0);
    const recordField = card.getByText("AFFC01000001", { exact: true });
    await expect(recordField).toBeVisible();
    await expect(
      card.getByRole("link", { name: "Open feature" }),
    ).toHaveAttribute("href", "/feature/fig%7C1004954.3.peg.1");

    await card.getByRole("button", { name: "Collapse details" }).click();
    await expect(recordField).toHaveCount(0);
    await expect(card).toContainText(focusGene);
    await card.getByRole("button", { name: "Expand details" }).click();
    await expect(recordField).toBeVisible();

    await compare.zoomInBy(2);
    await expect(card).toBeVisible();
    const geneBox = await gene.boundingBox();
    const cardBox = await card.boundingBox();
    if (!geneBox || !cardBox) throw new Error("no gene or card box");
    const cardLeft = cardBox.x;
    const cardRight = cardBox.x + cardBox.width;
    const nearGene = (x: number) =>
      x >= geneBox.x - 20 && x <= geneBox.x + geneBox.width + 20;
    expect(nearGene(cardLeft) || nearGene(cardRight)).toBe(true);

    await expect(compare.openFeature).toHaveAttribute(
      "href",
      "/feature/fig%7C1004954.3.peg.1",
    );

    await compare.closeFeatureCard();
    await expect(compare.selectionStrip).toHaveCount(0);
    await gene.click();
    await expect(card).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(card).toHaveCount(0);
    await expect(compare.selectionStrip).toHaveCount(0);
    await gene.click();
    await expect(card).toBeVisible();
    await compare.clearSelection.click();
    await expect(card).toHaveCount(0);
    await expect(compare.selectionStrip).toHaveCount(0);
  });

  test("on a phone, the expanded card fits the chart, its buttons in view", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 1000 });
    const compare = new CompareRegionPage(page);
    await compare.goto(featureId);
    await compare.expectFigure(10);
    await compare.scroller.focus();
    await page.keyboard.press("Tab");
    await expect(compare.glyph(0, 0)).toBeFocused();
    await expect(compare.tooltip).toContainText(focusGene);
    await page.keyboard.press("Enter");
    const card = compare.featureCard;
    await expect(card).toBeVisible();
    await expect(card.getByText("AFFC01000001", { exact: true })).toBeVisible();

    const chartBox = await compare.card.boundingBox();
    const cardBox = await card.boundingBox();
    if (!chartBox || !cardBox) throw new Error("no chart or card box");
    expect(cardBox.x).toBeGreaterThanOrEqual(chartBox.x);
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(
      Math.min(chartBox.x + chartBox.width, 320),
    );
    for (const name of ["Collapse details", "Close details"]) {
      await expect(card.getByRole("button", { name })).toBeInViewport({
        ratio: 1,
      });
    }
    await card.getByRole("button", { name: "Close details" }).click();
    await expect(card).toHaveCount(0);
  });

  test("the keyboard moves between genes, pins one, and brings one off the plot into view", async ({
    page,
  }) => {
    const compare = new CompareRegionPage(page);
    await compare.goto(featureId);
    await compare.expectFigure(10);
    const focused = compare.figure.locator("[data-feature]:focus");

    await compare.zoomInBy(4);
    await compare.scroller.focus();
    await page.keyboard.press("Tab");
    const gene = compare.glyph(0, 0);
    await expect(gene).toBeFocused();
    await expect(compare.tooltip).toContainText(focusGene);

    await page.keyboard.press("ArrowRight");
    await expect(gene).not.toBeFocused();
    await expect(focused).toHaveAttribute("data-row", "0");
    await expect(compare.tooltip).not.toContainText(focusGene);
    await page.keyboard.press("ArrowLeft");
    await expect(gene).toBeFocused();

    await page.keyboard.press("End");
    await expect(focused).toHaveAttribute("data-row", "0");
    await expect(focused).not.toHaveAttribute("data-feature", "0");
    await expect(compare.tooltip).toContainText("fig|1004954.3.peg.6");
    const scrollerBox = await compare.scroller.boundingBox();
    const endBox = await focused.boundingBox();
    if (!scrollerBox || !endBox) throw new Error("no scroller or gene box");
    expect(endBox.x).toBeGreaterThanOrEqual(scrollerBox.x);
    expect(endBox.x).toBeLessThan(scrollerBox.x + scrollerBox.width / 2);
    await expect(compare.zoomLevel).toHaveText("5.1×");

    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowDown");
    await expect(focused).toHaveAttribute("data-row", "1");
    const pinned = await focused.getAttribute("data-feature");
    expect(pinned).not.toBeNull();

    await page.keyboard.press("Enter");
    await expect(compare.featureCard).toBeVisible();
    await expect(compare.selectionStrip).toBeVisible();
    // WebKit would send the next Tab to the top of the page if the gene were blurred.
    await expect(focused).toHaveAttribute("data-row", "1");
    await expect(focused).toHaveAttribute("data-feature", pinned ?? "");
    await page.keyboard.press("Tab");
    await expect(
      compare.featureCard.getByRole("button", { name: "Collapse details" }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      compare.featureCard.getByRole("button", { name: "Close details" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(compare.featureCard).toHaveCount(0);
    await expect(focused).toHaveAttribute("data-row", "1");
    await expect(focused).toHaveAttribute("data-feature", pinned ?? "");
    await expect(compare.tooltip).toBeVisible();
  });

  test("a gene shows the pointer cursor, the track the grab hand, a drag the grabbing hand", async ({
    page,
  }) => {
    const compare = new CompareRegionPage(page);
    await compare.goto(featureId);
    await compare.expectFigure(10);
    const gene = compare.glyph(0, 0);
    await expect(gene).toHaveCSS("cursor", "pointer");
    await expect(compare.trackBackground()).toHaveCSS("cursor", "grab");

    const box = await gene.boundingBox();
    if (!box) throw new Error("the gene has no box");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 40, y, { steps: 4 });
    await expect(gene).toHaveCSS("cursor", "grabbing");
    await page.mouse.up();
    await expect(gene).toHaveCSS("cursor", "pointer");
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
