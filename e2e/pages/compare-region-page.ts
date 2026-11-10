import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The Feature View's Compare Region tab (`/feature/<id>?tab=compare-region`):
 * one card with a command bar, selection strip and an svg figure whose glyphs
 * are buttons carrying `data-row`/`data-feature`.
 */
export class CompareRegionPage {
  readonly page: Page;
  readonly card: Locator;
  readonly figure: Locator;
  readonly scroller: Locator;
  readonly zoomIn: Locator;
  readonly zoomOut: Locator;
  readonly fit: Locator;
  readonly zoomLevel: Locator;
  readonly genomesMenu: Locator;
  readonly tooltip: Locator;
  readonly selectionStrip: Locator;
  readonly openFeature: Locator;
  readonly clearSelection: Locator;
  readonly featureCard: Locator;
  readonly panLayers: Locator;
  /** Zoom's container once it has rendered a drag's start. */
  readonly dragging: Locator;

  constructor(page: Page) {
    this.page = page;
    this.card = page.getByRole("region", { name: "Compare regions" });
    this.figure = this.card.getByRole("group", {
      name: /^Compared regions of \d+ genomes?$/,
    });
    this.scroller = this.card.getByRole("group", {
      name: "Compared regions (scrollable)",
    });
    this.zoomIn = this.card.getByRole("button", { name: "Zoom in" });
    this.zoomOut = this.card.getByRole("button", { name: "Zoom out" });
    this.fit = this.card.getByRole("button", { name: "Fit the whole region" });
    this.zoomLevel = this.card.locator("output");
    this.genomesMenu = this.card.getByRole("button", { name: /^Genomes: / });
    this.tooltip = this.card.locator("[data-feature-tooltip]");
    this.selectionStrip = this.card.locator("[data-selection-strip]");
    this.openFeature = this.selectionStrip.getByRole("link", {
      name: "Open feature",
    });
    this.clearSelection = this.selectionStrip.getByRole("button", {
      name: "Clear selection",
    });
    this.featureCard = this.card.getByRole("dialog", {
      name: "Feature details",
    });
    this.panLayers = this.figure.locator("[data-pan]");
    this.dragging = this.figure.locator("svg[data-dragging]");
  }

  async closeFeatureCard(): Promise<void> {
    await this.featureCard
      .getByRole("button", { name: "Close details" })
      .click();
    await expect(this.featureCard).toHaveCount(0);
  }

  async goto(featureId: string): Promise<void> {
    await this.page.goto(`/feature/${featureId}?tab=compare-region`);
  }

  async expectFigure(genomes: number): Promise<void> {
    await expect(this.figure).toHaveAccessibleName(
      `Compared regions of ${String(genomes)} ${genomes === 1 ? "genome" : "genomes"}`,
    );
    await expect.poll(() => this.drawnRowCount()).toBe(genomes);
  }

  async drawnRowCount(): Promise<number> {
    return this.figure.evaluate(
      (svg) =>
        new Set(
          [...svg.querySelectorAll("[data-row]")].map((glyph) =>
            glyph.getAttribute("data-row"),
          ),
        ).size,
    );
  }

  async figureHeight(): Promise<number> {
    return Number(await this.figure.getAttribute("height"));
  }

  glyph(row: number, feature: number): Locator {
    return this.figure.locator(
      `[data-row="${String(row)}"][data-feature="${String(feature)}"]`,
    );
  }

  trackBackground(): Locator {
    return this.figure.locator("[data-track-background]");
  }

  /**
   * The veil the trace lays over the tracks while a family is traced
   * (`data-trace-veil`, one of the `data-overlay` layers): transparent at rest.
   */
  traceVeil(): Locator {
    return this.figure.locator("[data-trace-veil]");
  }

  traceSlots(): Locator {
    return this.figure.locator("[data-trace-slot]");
  }

  densityToggle(next: "Comfortable" | "Compact"): Locator {
    return this.card.getByRole("button", {
      name: `Switch to ${next} density`,
      exact: true,
    });
  }

  async chooseDensity(name: "Comfortable" | "Compact"): Promise<void> {
    await this.densityToggle(name).click();
    await expect(
      this.densityToggle(name === "Compact" ? "Comfortable" : "Compact"),
    ).toBeVisible();
  }

  async zoomInBy(clicks: number): Promise<string> {
    for (let click = 0; click < clicks; click += 1) {
      const before = (await this.zoomLevel.textContent()) ?? "";
      await this.zoomIn.click();
      await expect(this.zoomLevel).not.toHaveText(before);
    }
    return (await this.zoomLevel.textContent()) ?? "";
  }

  async zoomInToLimit(): Promise<void> {
    for (let presses = 0; await this.zoomIn.isEnabled(); presses += 1) {
      if (presses === 20) throw new Error("Zoom in never disabled");
      await this.zoomInBy(1);
    }
  }

  async openGenomesMenu(): Promise<Locator> {
    await this.genomesMenu.click();
    const menu = this.page.getByRole("menu");
    await expect(menu).toBeVisible();
    return menu;
  }

  source(name: string): Locator {
    return this.page.getByRole("menuitemradio", { name, exact: true });
  }
}
