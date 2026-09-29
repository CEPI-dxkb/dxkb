import { expect, type Locator, type Page } from "@playwright/test";
import { encodePathSegment, encodeQueryComponent } from "@/lib/url";

export class SerologyPage {
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
    await this.page.getByRole("option", { name: "Serology" }).click();
    await search.getByRole("textbox").fill(query);
    await search.getByRole("textbox").press("Enter");
  }

  async refineCollection(query: string): Promise<void> {
    await this.collectionKeyword.fill(query);
  }

  async gotoMember(sampleIdentifier: string): Promise<void> {
    await this.page.goto(this.memberUrl(sampleIdentifier));
  }

  async expectCollection(query: string): Promise<void> {
    await expect(this.page).toHaveURL(
      `/serology?keyword=${encodeURIComponent(query)}`,
    );
    await expect(
      this.page.getByRole("heading", { level: 1, name: "Serology" }),
    ).toBeVisible();
    await expect(
      this.page
        .getByRole("banner")
        .getByRole("combobox", { name: "Search type" }),
    ).toContainText("Serology");
    await expect(
      this.page.getByRole("banner").getByRole("textbox"),
    ).toHaveValue(query);
    await expect(this.collectionKeyword).toHaveValue("");
  }

  memberLink(sampleIdentifier: string): Locator {
    return this.page.getByRole("link", { name: sampleIdentifier, exact: true });
  }

  async expectOverview(): Promise<void> {
    await expect(
      this.page.getByRole("heading", { level: 1, name: "000123" }),
    ).toBeVisible();
    await expect(
      this.page.getByText("ELISA/IgG test", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      this.page
        .getByText("Evidence of prior exposure; confirm clinically", {
          exact: true,
        })
        .first(),
    ).toBeVisible();
    await expect(this.page.getByText("2024-07", { exact: true })).toBeVisible();
  }

  async expectAmbiguityChoices(...testTypes: string[]): Promise<void> {
    await expect(
      this.page.getByRole("heading", { name: "Choose a serology test" }),
    ).toBeVisible();
    for (const testType of testTypes) {
      await expect(
        this.page.getByRole("link", { name: testType, exact: true }),
      ).toBeVisible();
    }
  }

  async chooseAmbiguityChoice(
    sampleIdentifier: string,
    testType: string,
  ): Promise<void> {
    await this.page.getByRole("link", { name: testType, exact: true }).click();
    await expect(this.page).toHaveURL(
      this.memberUrl(sampleIdentifier, testType),
    );
  }

  memberUrl(sampleIdentifier: string, testType?: string): string {
    const path = `/serology/${encodePathSegment(sampleIdentifier)}`;
    return testType === undefined
      ? path
      : `${path}?test_type=${encodeQueryComponent(testType)}`;
  }
}
