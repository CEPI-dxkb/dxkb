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
