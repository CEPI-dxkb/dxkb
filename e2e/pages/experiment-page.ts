import { expect, type Locator, type Page } from "@playwright/test";

export class ExperimentPage {
  readonly page: Page;
  readonly collectionKeyword: Locator;

  constructor(page: Page) {
    this.page = page;
    this.collectionKeyword = page.getByPlaceholder("Search keywords...");
  }

  async openMember(experimentId: string): Promise<void> {
    await this.page.getByRole("link", { name: experimentId, exact: true }).click();
    await expect(this.page).toHaveURL(`/experiment/${experimentId}`);
  }

  async openBiosets(): Promise<void> {
    await this.page.getByRole("button", { name: "Biosets" }).click();
    await expect(this.page).toHaveURL(/\?tab=biosets$/);
  }

  async openCollectionBiosets(): Promise<void> {
    await this.page
      .getByRole("button", { name: "Biosets", exact: true })
      .click();
    await expect(this.page).toHaveURL(/\/experiment\?.*tab=biosets/);
  }
}
