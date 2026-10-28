import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The Feature View's Compare Region tab (`/feature/<id>?tab=compare-region`):
 * one card (`<section aria-label="Compare regions">`) holding the command bar,
 * the selection strip with the Comfortable/Compact density toggle (one icon
 * button named for the density it switches to), and the
 * figure, an `<svg role="group">` with one row per genome. The figure's glyphs
 * are buttons named for their feature (one tab stop for the figure; the arrow
 * keys move between them) and carry `data-row` and `data-feature`, the hover
 * overlays `data-overlay`, and
 * the layers a drag slides `data-pan` (with a `transform` only mid-drag);
 * the tooltip is `[data-feature-tooltip]`, which hangs just below and right
 * of its glyph (left of it, or above it, where that side lacks room). A
 * click on a glyph pins it and pins its tooltip as the feature card, a
 * non-modal "Feature details" dialog in the card, expanded with the gene's
 * record; closing it clears the pin. The selection strip
 * (`[data-selection-strip]`) carries the pinned gene's own links.
 */
export class CompareRegionPage {
  readonly page: Page;
  readonly card: Locator;
  readonly figure: Locator;
  /** The figure's scroller, a tab stop of its own before the figure's. */
  readonly scroller: Locator;
  readonly zoomIn: Locator;
  readonly zoomOut: Locator;
  readonly fit: Locator;
  /** The zoom cluster's level text ("1.0×"), an `<output>`. */
  readonly zoomLevel: Locator;
  /** The "Genomes" source menu's trigger, named for the chosen source. */
  readonly genomesMenu: Locator;
  readonly tooltip: Locator;
  /** The selection strip while a gene is pinned. */
  readonly selectionStrip: Locator;
  /** The pinned gene's link, in the selection strip (the card has its own). */
  readonly openFeature: Locator;
  readonly clearSelection: Locator;
  /** The pinned gene's card: its tooltip, pinned and expanded. */
  readonly featureCard: Locator;
  /** The figure's layers a drag slides by a `transform` while it pans. */
  readonly panLayers: Locator;

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
  }

  /** Closes the feature card with its button, which clears the pin. */
  async closeFeatureCard(): Promise<void> {
    await this.featureCard
      .getByRole("button", { name: "Close details" })
      .click();
    await expect(this.featureCard).toHaveCount(0);
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

  /** The empty track between glyphs: a drag there pans, a click clears the pin. */
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

  /** The trace's two slots: the current family's, and the last one's while it fades out. */
  traceSlots(): Locator {
    return this.figure.locator("[data-trace-slot]");
  }

  /**
   * The density toggle while it offers `next`: "Switch to Compact density"
   * shows in Comfortable, and "Switch to Comfortable density" in Compact.
   */
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
