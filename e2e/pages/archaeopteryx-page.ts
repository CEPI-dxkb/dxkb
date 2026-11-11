import { expect, type Download, type Locator, type Page } from "@playwright/test";

/**
 * The taxonomy Phylogeny tab rendering a phyloXML tree in Archaeopteryx.js;
 * the node menu and hover tooltip are appended to the body.
 */
export class ArchaeopteryxPage {
  readonly page: Page;
  readonly frame: Locator;
  readonly host: Locator;
  readonly svg: Locator;
  readonly panel: Locator;
  readonly themeToggle: Locator;
  readonly displayData: Locator;
  readonly sidePanel: Locator;
  readonly loadingOverlay: Locator;

  constructor(page: Page) {
    this.page = page;
    this.frame = page.locator(".archaeopteryx-dxkb");
    this.host = page.getByRole("group", {
      name: /^Interactive phylogenetic tree for /,
    });
    this.svg = this.host.locator(":scope > svg");
    this.panel = this.host.locator(":scope > .aptx-panel");
    this.themeToggle = this.panel.locator(".aptx-theme-btn");
    this.displayData = this.panel.locator("fieldset", {
      has: page.locator("legend", { hasText: "Display Data" }),
    });
    this.sidePanel = page.locator('[data-testid$="detail-side"]');
    this.loadingOverlay = this.frame.locator(":scope > .absolute.inset-0");
  }

  async goto(taxonId: string): Promise<void> {
    await this.page.goto(`/taxonomy/${taxonId}?tab=phylogeny`);
    await this.waitForTree();
  }

  async waitForTree(): Promise<void> {
    await expect(this.panel).toBeVisible({ timeout: 30_000 });
    await expect(this.node("Leaf A")).toBeVisible();
    await expect(this.loadingOverlay).toHaveCount(0);
  }

  node(name: string): Locator {
    return this.svg.locator("g.node").filter({
      has: this.page.locator("text", { hasText: name }),
    });
  }

  displayCheckbox(label: string): Locator {
    return this.displayData.getByRole("checkbox", { name: label, exact: true });
  }

  /**
   * The viewer finds nodes by pointer position, not event target, so click
   * the node's own point rather than its label.
   */
  async selectLeaf(name: string): Promise<void> {
    const point = await this.node(name).evaluate((node) => {
      const matrix = (node as SVGGElement).getScreenCTM();
      if (!matrix) throw new Error("Expected the node to be rendered");
      return { x: matrix.e, y: matrix.f };
    });
    await this.page.mouse.click(point.x, point.y);
    await this.page
      .locator(".aptx-node-menu")
      .getByRole("button", { name: "Select/Deselect Node", exact: true })
      .click();
  }

  /** The Download section starts folded. */
  async openDownloadMenu(): Promise<void> {
    const section = this.panel.locator("fieldset.aptx-download");
    if ((await section.getAttribute("class"))?.includes("aptx-collapsed")) {
      await section.locator(":scope > legend").click();
    }
    await section.getByRole("button", { name: "Download…", exact: true }).click();
  }

  async download(format: string): Promise<Download> {
    await this.openDownloadMenu();
    const download = this.page.waitForEvent("download");
    await this.page
      .locator(".aptx-node-menu")
      .getByRole("button", { name: new RegExp(`^${format}`) })
      .click();
    return download;
  }

  canvasBackground(): Promise<string> {
    return this.svg
      .locator("rect.basebackground")
      .evaluate((element) => getComputedStyle(element).fill);
  }

  expectedCanvasBackground(): Promise<string> {
    return this.page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.color =
        "color-mix(in oklab, var(--input) 30%, var(--card))";
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
  }
}
