import { readFile } from "node:fs/promises";
import { applyBackendMocks, expect, test } from "../mocks/backends";
import {
  circularViewerFixture,
  circularViewerScenarioOverrides,
  emptyBackendFallbackOverrides,
} from "../fixtures/overrides";
import { CircularViewerPanelPage } from "../pages";
import { failOnRuntimeErrors } from "../support/runtime-errors";

/**
 * The Genome View's Circular Viewer tab on `bacterialGenomeRecord` (the viral fixture
 * has the tab disabled).
 */
const overrides = [
  ...circularViewerScenarioOverrides,
  ...emptyBackendFallbackOverrides,
];
const { genomeId, accession, forwardFeature, customFeature } =
  circularViewerFixture;

// Signed out: signed in, the data service client refuses to send the token to the
// loopback's plain-http URL.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Circular Viewer", () => {
  let assertNoRuntimeErrors: () => void;

  test.beforeEach(async ({ page }) => {
    assertNoRuntimeErrors = failOnRuntimeErrors(page);
    await applyBackendMocks(page, { overrides: [...overrides] });
  });

  test.afterEach(() => {
    assertNoRuntimeErrors();
  });

  test("draws the default tracks and names the feature under the pointer", async ({
    page,
  }) => {
    const viewer = new CircularViewerPanelPage(page);
    await viewer.goto(genomeId);
    const box = await viewer.figure().boundingBox();
    if (!box) throw new Error("The Circular Viewer figure has no layout box.");
    expect(box.width).toBeGreaterThan(200);
    expect(box.height).toBeGreaterThan(200);

    await viewer.expectTrackReady("cds-forward");
    await viewer.expectTrackReady("gc-skew");
    await expect(viewer.trackRow("AMR Genes")).toContainText("None found");

    await viewer.hoverRing("cds-forward", Math.PI / 2);
    await expect(viewer.tooltip()).toContainText(forwardFeature.patricId);
    await expect(viewer.tooltip()).toContainText(forwardFeature.product);
    const tip = await viewer.tooltip().boundingBox();
    if (!tip) throw new Error("The Circular Viewer tooltip has no layout box.");
    expect(tip.x + tip.width).toBeLessThanOrEqual(box.x + box.width);

    await viewer.clickRing("cds-forward", Math.PI / 2);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`${accession}:1..25000 (+)`);
    await expect(
      dialog.getByRole("link", { name: "Open Feature View" }),
    ).toHaveAttribute("href", `/feature/${forwardFeature.featureId}`);
  });

  for (const size of [
    { width: 375, height: 812 },
    { width: 1024, height: 768 },
  ]) {
    test(`keeps the tooltip inside the figure at ${String(size.width)}x${String(size.height)}`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      const viewer = new CircularViewerPanelPage(page);
      await viewer.goto(genomeId);
      await viewer.expectTrackReady("cds-forward");
      await viewer.figure().scrollIntoViewIfNeeded();
      const box = await viewer.figure().boundingBox();
      if (!box) throw new Error("The Circular Viewer figure has no layout box.");

      await viewer.hoverRing("cds-forward", Math.PI / 2);
      await expect(viewer.tooltip()).toContainText(forwardFeature.patricId);
      const tip = await viewer.tooltip().boundingBox();
      if (!tip) throw new Error("The Circular Viewer tooltip has no layout box.");
      expect(tip.x).toBeGreaterThanOrEqual(box.x);
      expect(tip.x + tip.width).toBeLessThanOrEqual(box.x + box.width);
      expect(tip.y).toBeGreaterThanOrEqual(box.y);
      expect(tip.y + tip.height).toBeLessThanOrEqual(box.y + box.height);
      expect(tip.x + tip.width).toBeLessThanOrEqual(size.width);
    });
  }

  test("fits the screen: the sidebar scrolls, the page does not", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1000, height: 620 });
    const viewer = new CircularViewerPanelPage(page);
    await viewer.goto(genomeId);
    await viewer.expectTrackReady("cds-forward");
    const sidebar = viewer.root().locator("aside");
    await expect
      .poll(() => sidebar.evaluate((node) => node.scrollHeight > node.clientHeight))
      .toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight,
      ),
    ).toBeLessThanOrEqual(0);
    const card = await viewer.root().boundingBox();
    if (!card) throw new Error("The Circular Viewer card has no layout box.");
    expect(card.y + card.height).toBeLessThanOrEqual(620);
  });

  test("the keyboard reaches an item and opens its details", async ({
    page,
  }) => {
    const viewer = new CircularViewerPanelPage(page);
    await viewer.goto(genomeId);
    await viewer.expectTrackReady("cds-forward");

    await viewer.root().getByRole("link", { name: "User guide" }).focus();
    await page.keyboard.press("Tab");
    await expect(viewer.figureTabStop()).toBeFocused();
    await expect(viewer.tooltip()).toContainText(accession);

    await page.keyboard.press("ArrowDown");
    await expect(viewer.tooltip()).toContainText(forwardFeature.patricId);
    await expect(viewer.figure().locator("[data-overlay]")).toHaveCount(1);

    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`${accession}:1..25000 (+)`);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(viewer.figureTabStop()).toBeFocused();
    await expect(viewer.tooltip()).toContainText(forwardFeature.patricId);
  });

  test("adds a custom track and an uploaded histogram", async ({ page }) => {
    const viewer = new CircularViewerPanelPage(page);
    await viewer.goto(genomeId);

    await viewer.chooseOption("Feature type", "CDS");
    await viewer.chooseOption("Strand", "Both");
    await viewer.root().getByLabel("Keyword").fill("transposase");
    await viewer
      .root()
      .getByRole("button", { name: "Add custom track" })
      .click();
    await viewer.expectTrackReady("custom-1");
    await expect(viewer.trackRow("transposase")).toBeVisible();
    await viewer.hoverRing("custom-1", 0.62 * 2 * Math.PI);
    await expect(viewer.tooltip()).toContainText(customFeature.product);

    await viewer.uploadUserTrack(
      "Histogram",
      "scores.tsv",
      `${accession}\t1\t10000\t0.5\n${accession}\t10001\t20000\t-0.25\n`,
    );
    await viewer.expectTrackReady("user-1");
    await expect(viewer.trackRow("User track 1")).toBeVisible();
  });

  test("exports the figure as a standalone SVG", async ({ page }) => {
    const viewer = new CircularViewerPanelPage(page);
    await viewer.goto(genomeId);
    await viewer.expectTrackReady("cds-forward");

    // Export is pressed from the keyboard so the pointer stays on the item; its hover
    // highlight must not be in the file.
    const exportButton = viewer.root().getByRole("button", { name: "Export SVG" });
    await expect(exportButton).toBeEnabled();
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dxkb-dark");
    });
    const contigFill = () =>
      viewer
        .ring("contigs")
        .locator("path")
        .first()
        .evaluate((path) => getComputedStyle(path).fill);
    expect(await contigFill()).not.toBe("rgb(0, 15, 125)");
    await viewer.hoverRing("cds-forward", Math.PI / 2);
    await expect(viewer.figure().locator("[data-overlay]")).toHaveCount(1);
    const download = page.waitForEvent("download");
    await exportButton.focus();
    await page.keyboard.press("Enter");
    const file = await download;
    await expect(viewer.figure().locator("[data-overlay]")).toHaveCount(1);

    expect(file.suggestedFilename()).toBe(`circular-genome-${genomeId}.svg`);
    const svg = await readFile(await file.path(), "utf8");
    expect(svg).toContain("<svg");
    expect(svg).not.toContain("data-overlay");
    expect(svg).toContain('data-track="cds-forward"');
    // A ring still sweeping in exports whole only at rest (its mask's dash offset is
    // the animation's).
    expect(svg).toMatch(/data-track="contigs"[^>]*>(?:\s*<mask[\s\S]*?<\/mask>)?\s*<g[^>]*>\s*<path[^>]*fill="rgb\(0, 15, 125\)"/);
    expect(svg).not.toContain("stroke-dashoffset");
  });
});
