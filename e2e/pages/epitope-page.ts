import { expect, type Locator, type Page } from "@playwright/test";

export class EpitopePage {
  readonly page: Page;
  readonly collectionKeyword: Locator;

  constructor(page: Page) {
    this.page = page;
    this.collectionKeyword = page.getByPlaceholder("Search keywords...");
  }

  async searchFromWelcome(query: string): Promise<void> {
    await this.page.goto("/");
    const search = this.page.locator(".welcome-search-card form");
    await search.getByRole("combobox", { name: "Search type" }).click();
    await this.page.getByRole("option", { name: "Epitopes" }).click();
    await search.getByRole("textbox").fill(query);
    await search.getByRole("textbox").press("Enter");
  }

  async expectCollection(query: string): Promise<void> {
    await this.expectCollectionUrl(query);
    await expect(
      this.page.getByRole("heading", { level: 1, name: "Epitopes" }),
    ).toBeVisible();
    await expect(
      this.page
        .getByRole("banner")
        .getByRole("combobox", { name: "Search type" }),
    ).toContainText("Epitopes");
    await expect(
      this.page.getByRole("banner").getByRole("textbox"),
    ).toHaveValue(query);
    await expect(this.collectionKeyword).toHaveValue("");
  }

  async expectCollectionUrl(query: string): Promise<void> {
    await expect(this.page).toHaveURL(
      `/epitope?keyword=${encodeURIComponent(query)}`,
    );
  }

  memberLink(epitopeId: string): Locator {
    return this.page.getByRole("link", { name: epitopeId, exact: true });
  }

  async filterCollection(query: string): Promise<void> {
    await this.collectionKeyword.fill(query);
  }

  async clearCollectionFilter(): Promise<void> {
    await this.collectionKeyword.clear();
  }

  async expectMemberVisible(epitopeId: string): Promise<void> {
    await expect(this.memberLink(epitopeId)).toBeVisible();
  }

  async expectNoResults(): Promise<void> {
    await expect(this.page.getByText("No results")).toBeVisible();
  }

  async selectFacet(name: string): Promise<void> {
    await this.page.getByRole("button", { name: "Show Filters" }).click();
    await this.page.getByRole("button", { name }).click();
  }

  async openMember(epitopeId: string): Promise<void> {
    await this.memberLink(epitopeId).click();
    await expect(this.page).toHaveURL(`/epitope/${epitopeId}`);
  }

  async gotoMemberAssays(epitopeId: string): Promise<void> {
    await this.page.goto(`/epitope/${epitopeId}?tab=assays`);
  }

  async expectMemberShell(epitopeId: string): Promise<void> {
    await expect(
      this.page.getByRole("link", { name: /View in IEDB/ }),
    ).toHaveAttribute("href", `https://www.iedb.org/epitope/${epitopeId}`);
  }

  async expectStructure(text: string): Promise<void> {
    await expect(this.page.getByText(text).first()).toBeVisible();
  }

  async openAssays(): Promise<void> {
    await this.page.getByRole("button", { name: "Assays" }).click();
  }

  async expectAssays(...names: string[]): Promise<void> {
    await expect(this.page).toHaveURL(/\?tab=assays$/);
    for (const name of names) {
      await expect(this.page.getByText(name)).toBeVisible();
    }
  }

  async expectError(message: string | RegExp): Promise<void> {
    await expect(this.page.getByText(message)).toBeVisible();
  }
}
