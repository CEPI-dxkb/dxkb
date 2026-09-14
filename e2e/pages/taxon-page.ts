import { expect, type Locator, type Page } from "@playwright/test";

/** Taxonomy landing page with its data-view tabs (serology, strains, epitopes, ...). */
export class TaxonPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(taxonId: string, tab: string): Promise<void> {
    await this.page.goto(`/taxonomy/${taxonId}?tab=${tab}`);
    await expect(this.page).toHaveURL(new RegExp(`tab=${tab}`));
  }

  /** The tab's nav-sidebar button, e.g. "Serology", "Strains". */
  tabButton(name: string): Locator {
    return this.page.getByRole("button", { name });
  }

  /** The "Showing X-Y of Z results" pagination summary. */
  resultsSummary(text: string): Locator {
    return this.page.getByText(text);
  }

  /** A data cell by its rendered text, e.g. a row's sample identifier. */
  rowCell(text: string): Locator {
    return this.page.getByText(text);
  }

  async selectAllRowsOnPage(): Promise<void> {
    await this.page
      .getByRole("checkbox", { name: /select all rows on this page/i })
      .click();
  }

  async openAssociatedGenomes(): Promise<void> {
    await this.page
      .getByRole("complementary")
      .getByRole("button", { name: /genomes/i })
      .click();
  }
}
