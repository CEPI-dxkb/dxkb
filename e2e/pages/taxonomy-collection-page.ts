import { expect, type Page } from "@playwright/test";

export class TaxonomyCollectionPage {
  constructor(readonly page: Page) {}

  async searchFromWelcome(query: string): Promise<void> {
    await this.page.goto("/");
    const search = this.page.locator(".welcome-search-card form");
    await search.getByRole("combobox", { name: "Search type" }).click();
    await this.page.getByRole("option", { name: "Taxa" }).click();
    await search.getByRole("textbox").fill(query);
    await search.getByRole("button", { name: "Search", exact: true }).click();
  }

  async gotoLegacySearch(query: string): Promise<void> {
    await this.page.goto(`/search?type=taxonomy&q=${encodeURIComponent(query)}`);
  }

  async expectCollection(query: string): Promise<void> {
    await expect(this.page).toHaveURL(
      `/taxonomy?keyword=${encodeURIComponent(query)}`,
    );
    await expect(
      this.page
        .getByRole("banner")
        .getByRole("combobox", { name: "Search type" }),
    ).toContainText("Taxa");
    await expect(
      this.page.getByRole("banner").getByRole("textbox"),
    ).toHaveValue(query);
    await expect(this.page.getByPlaceholder("Search keywords...")).toHaveValue(
      "",
    );
  }

  async expectTaxonVisible(taxonId: string): Promise<void> {
    await expect(
      this.page.getByRole("row", {
        name: new RegExp(`Select row ${taxonId}`),
      }),
    ).toBeVisible();
  }

  async selectTaxon(taxonId: string, taxonName: string): Promise<void> {
    await this.page
      .getByRole("checkbox", { name: `Select row ${taxonId}` })
      .check();
    await expect(
      this.page.getByRole("heading", { level: 3, name: taxonName }),
    ).toBeVisible();
    await expect(
      this.page.getByRole("button", { name: /TAXON\s*OVERVIEW/i }),
    ).toBeEnabled();
  }

  /** Narrow the collection with its own keyword box (the `refine` query). */
  async filterCollection(query: string): Promise<void> {
    await this.page.getByPlaceholder("Search keywords...").fill(query);
  }

  /** Select the page with the header checkbox, then every matching result. */
  async selectAllResults(): Promise<void> {
    await this.page
      .getByRole("checkbox", { name: "Select all rows on this page" })
      .check();
    await this.page
      .getByRole("button", { name: /^Select all \d+ results across all pages$/ })
      .click();
    await expect(
      this.page.getByText(/^All \d+ results are selected across all pages\.$/),
    ).toBeVisible();
  }

  /**
   * The collection's live status reads "Refreshing results..." while the rows and total on screen
   * belong to an earlier query (placeholder data), and the result count once the current one lands.
   */
  async expectRefreshing(refreshing: boolean): Promise<void> {
    await expect(
      this.page.getByText("Refreshing results...", { exact: true }),
    ).toHaveCount(refreshing ? 1 : 0);
  }

  async openServices(): Promise<void> {
    const services = this.page.getByRole("button", {
      name: "SERVICES",
      exact: true,
    });
    await expect(services).toBeEnabled();
    await services.click();
  }

  async expectServiceOptions(): Promise<void> {
    await expect(
      this.page.getByRole("heading", {
        name: "Use selected Taxa in a service",
      }),
    ).toBeVisible();
    await expect(
      this.page.getByRole("button", { name: "BLAST against selected Taxa" }),
    ).toBeEnabled();
  }
}
