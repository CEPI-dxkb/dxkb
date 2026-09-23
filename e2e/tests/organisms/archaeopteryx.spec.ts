import { readFile } from "node:fs/promises";

import { type Download, type Page } from "@playwright/test";

import { applyBackendMocks, expect, test } from "../../mocks/backends";
import { ArchaeopteryxPage } from "../../pages";

const treeXml = `<?xml version="1.0" encoding="UTF-8"?>
<phyloxml xmlns="http://www.phyloxml.org">
  <phylogeny rooted="true">
    <name>Regression tree</name>
    <clade>
      <name>Root</name>
      <confidence type="bootstrap">100</confidence>
      <clade>
        <name>Leaf A</name>
        <branch_length>0.1</branch_length>
        <property ref="dxkb:genome_name" datatype="xsd:string" applies_to="node">Genome A</property>
        <property ref="dxkb:host_common_name" datatype="xsd:string" applies_to="node">Human</property>
        <property ref="dxkb:in-group" datatype="xsd:string" applies_to="node">Yes</property>
      </clade>
      <clade>
        <name>Leaf B</name>
        <branch_length>0.2</branch_length>
        <property ref="dxkb:genome_name" datatype="xsd:string" applies_to="node">Genome B</property>
        <property ref="dxkb:host_common_name" datatype="xsd:string" applies_to="node">Animal</property>
        <property ref="dxkb:in-group" datatype="xsd:string" applies_to="node">No</property>
      </clade>
    </clade>
  </phylogeny>
</phyloxml>`;

async function openPhylogeny(page: Page) {
  await applyBackendMocks(page);
  await page.route(
    /\/api\/content\/bvbrc_phylogeny_tab\/taxon_tree_dict\.json$/,
    (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ 234: "regression.xml" }),
      }),
  );
  await page.route(
    /\/api\/content\/bvbrc_phylogeny_tab\/phyloxml\/regression\.xml$/,
    (route) => route.fulfill({ contentType: "application/xml", body: treeXml }),
  );

  const tree = new ArchaeopteryxPage(page);
  await tree.goto("234");
  return tree;
}

async function downloadedBytes(download: Download) {
  const path = await download.path();
  expect(path).not.toBeNull();
  return readFile(path);
}

const box = async (locator: ReturnType<Page["locator"]>) => {
  const value = await locator.boundingBox();
  if (!value)
    throw new Error(`Expected ${locator.toString()} to have a bounding box`);
  return value;
};

test.use({
  storageState: { cookies: [], origins: [] },
  viewport: { width: 1280, height: 900 },
});
test.setTimeout(60_000);

test.describe("Archaeopteryx phylogeny viewer", () => {
  test("draws the tree with its control panel and property label fields", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const tree = await openPhylogeny(page);

    await expect(tree.node("Leaf B")).toBeVisible();
    for (const label of [
      "Node Name",
      "Genome Name",
      "Host Common Name",
      "In Group",
    ]) {
      await expect(tree.displayCheckbox(label)).toBeAttached();
    }
    await expect(tree.themeToggle).toBeHidden();
    expect(
      await tree.panel.locator("#exp_f_sel option").allTextContents(),
    ).toEqual(
      expect.arrayContaining(["PNG", "PDF", "SVG", "phyloXML", "Newick"]),
    );
    expect(await tree.canvasBackground()).toBe(
      await tree.expectedCanvasBackground(),
    );

    await tree.displayCheckbox("Genome Name").check({ force: true });
    await expect(tree.svg.getByText(/Genome A/)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("opens in the site's dark theme and follows theme changes without rebuilding the tree", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("theme", "dxkb-dark");
    });
    const tree = await openPhylogeny(page);

    await expect(tree.panel).toHaveClass(/\baptx-dark\b/);
    const darkBackground = await tree.canvasBackground();
    expect(darkBackground).toBe(await tree.expectedCanvasBackground());
    await tree.svg.evaluate((element) => {
      element.dataset.themeIdentity = "preserve";
    });

    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dxkb-light";
    });

    await expect(tree.panel).toHaveClass(/\baptx-light\b/);
    await expect(tree.svg).toHaveAttribute("data-theme-identity", "preserve");
    await expect.poll(() => tree.canvasBackground()).not.toBe(darkBackground);
    expect(await tree.canvasBackground()).toBe(
      await tree.expectedCanvasBackground(),
    );
  });

  test("shows a selected leaf in the side panel and keeps the tree fitted while it resizes", async ({
    page,
  }) => {
    const tree = await openPhylogeny(page);
    const expectFitted = async () => {
      await expect
        .poll(async () => {
          const host = await box(tree.host);
          const svg = await box(tree.svg);
          return (
            Math.abs(svg.width - host.width) <= 1 &&
            Math.abs(svg.height - host.height) <= 1
          );
        })
        .toBe(true);
    };

    const closedWidth = (await box(tree.host)).width;
    await tree.selectLeaf("Leaf A");

    await expect(tree.sidePanel.getByText("Selected leaf")).toBeVisible();
    await expect(
      tree.sidePanel.getByRole("heading", { name: "Leaf A" }),
    ).toBeVisible();
    await expect(
      tree.sidePanel.getByText("dxkb:host_common_name"),
    ).toBeVisible();
    await expect
      .poll(async () => (await box(tree.host)).width)
      .toBeLessThan(closedWidth);
    await expectFitted();

    const separator = page.getByRole("separator");
    const separatorBox = await box(separator);
    const openWidth = (await box(tree.host)).width;
    await page.mouse.move(
      separatorBox.x,
      separatorBox.y + separatorBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      separatorBox.x - 100,
      separatorBox.y + separatorBox.height / 2,
      { steps: 5 },
    );
    await page.mouse.up();
    await expect
      .poll(async () => (await box(tree.host)).width)
      .toBeLessThan(openWidth);
    await expectFitted();
  });

  test("downloads the tree as PNG, PDF and SVG", async ({ page }) => {
    const tree = await openPhylogeny(page);

    const png = await tree.download("PNG");
    expect(png.suggestedFilename()).toMatch(/\.png$/);
    expect([...(await downloadedBytes(png)).subarray(0, 8)]).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ]);

    const pdf = await tree.download("PDF");
    expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
    expect((await downloadedBytes(pdf)).subarray(0, 5).toString()).toBe(
      "%PDF-",
    );

    const svg = await tree.download("SVG");
    expect(svg.suggestedFilename()).toMatch(/\.svg$/);
    const svgText = (await downloadedBytes(svg)).toString();
    expect(svgText).toContain("<svg");
    expect(svgText).toContain("Leaf A");
  });
});
