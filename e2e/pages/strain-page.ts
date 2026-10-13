import { expect, type Locator, type Page } from "@playwright/test";

export class StrainPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async gotoAllTypesSearch(query: string): Promise<void> {
    await this.page.goto(
      `/search?type=everything&q=${encodeURIComponent(query)}`,
    );
  }

  async gotoCollection(): Promise<void> {
    await this.page.goto("/strain");
    await expect(
      this.page.getByRole("heading", { level: 1, name: "Strains" }),
    ).toBeVisible();
  }

  /** Every link titled with this strain name; records can share one. */
  strainLinks(name: string): Locator {
    return this.page.getByRole("link", { name, exact: true });
  }

  async expectMember(strainId: string, name: string): Promise<void> {
    await expect(this.page).toHaveURL(`/strain/${strainId}`);
    await expect(
      this.page.getByRole("heading", { level: 1, name }),
    ).toBeVisible();
    await expect(
      this.page.getByText("Segments and genomes", { exact: true }),
    ).toBeVisible();
  }

  async expectSummary(label: string, value: string): Promise<void> {
    await expect(
      this.page.getByText(`${label}:`, { exact: true }).locator(".."),
    ).toHaveText(`${label}: ${value}`);
  }

  viewGenomesLink(): Locator {
    return this.page.getByRole("link", { name: /View genomes/ });
  }
}
