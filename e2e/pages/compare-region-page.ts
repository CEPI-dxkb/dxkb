import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The Feature View's Compare Region tab (`/feature/<id>?tab=compare-region`):
 * one card (`<section aria-label="Compare regions">`) holding the command bar,
 * the selection strip with the Comfortable/Compact density toggle, and the
 * figure, an `<svg role="img">` with one row per genome. The figure's glyphs
 * carry `data-row` and `data-feature`, the hover overlays `data-overlay`;
 * the tooltip is visx's `.visx-tooltip`.
 */
export class CompareRegionPage {
  readonly page: Page;
  readonly card: Locator;
  readonly figure: Locator;
  readonly zoomIn: Locator;
  readonly zoomOut: Locator;
  readonly fit: Locator;
  /** The zoom cluster's level text ("1.0×"), an `<output>`. */
  readonly zoomLevel: Locator;
  /** The "Genomes" source menu's trigger, named for the chosen source. */
  readonly genomesMenu: Locator;
  readonly tooltip: Locator;
  /** The pinned gene's link, in the selection strip. */
  readonly openFeature: Locator;
  readonly clearSelection: Locator;

  constructor(page: Page) {
    this.page = page;
    this.card = page.getByRole("region", { name: "Compare regions" });
    this.figure = this.card.getByRole("img", {
      name: /^Compared regions of \d+ genomes?$/,
    });
    this.zoomIn = this.card.getByRole("button", { name: "Zoom in" });
    this.zoomOut = this.card.getByRole("button", { name: "Zoom out" });
    this.fit = this.card.getByRole("button", { name: "Fit the whole region" });
    this.zoomLevel = this.card.locator("output");
    this.genomesMenu = this.card.getByRole("button", { name: /^Genomes: / });
    this.tooltip = this.card.locator(".visx-tooltip");
    this.openFeature = this.card.getByRole("link", { name: "Open feature" });
    this.clearSelection = this.card.getByRole("button", {
      name: "Clear selection",
    });
  }

  async goto(featureId: string): Promise<void> {
    await this.page.goto(`/feature/${featureId}?tab=compare-region`);
  }

  /** The figure is drawn for `genomes` genomes: its name says so, and its glyphs fill that many rows. */
  async expectFigure(genomes: number): Promise<void> {
    await expect(this.figure).toHaveAccessibleName(
      `Compared regions of ${String(genomes)} ${genomes === 1 ? "genome" : "genomes"}`,
    );
    await expect.poll(() => this.drawnRowCount()).toBe(genomes);
  }

  /** How many rows have at least one glyph drawn. */
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

  /** The figure's height, px, from its `height` attribute. */
  async figureHeight(): Promise<number> {
    return Number(await this.figure.getAttribute("height"));
  }

  /** A feature's glyph, by its row (0 is the focus gene's genome) and its index in that row. */
  glyph(row: number, feature: number): Locator {
    return this.figure.locator(
      `[data-row="${String(row)}"][data-feature="${String(feature)}"]`,
    );
  }

  /**
   * The veil the trace lays over the tracks while a family is traced (the
   * first `data-overlay` layer's backdrop): transparent at rest.
   */
  traceVeil(): Locator {
    return this.figure.locator("[data-overlay] > rect").first();
  }

  /** One of the density toggle's options ("Comfortable", "Compact"). */
  densityOption(name: "Comfortable" | "Compact"): Locator {
    return this.card
      .getByRole("group", { name: "Density" })
      .getByRole("button", { name, exact: true });
  }

  async chooseDensity(name: "Comfortable" | "Compact"): Promise<void> {
    await this.densityOption(name).click();
    await expect(this.densityOption(name)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }

  /** Press Zoom in, waiting for the level to change each time; returns the level text. */
  async zoomInBy(clicks: number): Promise<string> {
    for (let click = 0; click < clicks; click += 1) {
      const before = (await this.zoomLevel.textContent()) ?? "";
      await this.zoomIn.click();
      await expect(this.zoomLevel).not.toHaveText(before);
    }
    return (await this.zoomLevel.textContent()) ?? "";
  }

  /** Press Zoom in until it disables, failing after 20 presses. */
  async zoomInToLimit(): Promise<void> {
    for (let presses = 0; await this.zoomIn.isEnabled(); presses += 1) {
      if (presses === 20) throw new Error("Zoom in never disabled");
      await this.zoomInBy(1);
    }
  }

  /** Open the "Genomes" menu; returns it. */
  async openGenomesMenu(): Promise<Locator> {
    await this.genomesMenu.click();
    const menu = this.page.getByRole("menu");
    await expect(menu).toBeVisible();
    return menu;
  }

  /** A source in the open "Genomes" menu ("Selected genome group", …). */
  source(name: string): Locator {
    return this.page.getByRole("menuitemradio", { name, exact: true });
  }
}
