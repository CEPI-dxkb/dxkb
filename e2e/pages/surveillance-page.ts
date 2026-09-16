import { expect, type Locator, type Page } from "@playwright/test";

export class SurveillancePage {
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
    await this.page.getByRole("option", { name: "Surveillance" }).click();
    await search.getByRole("textbox").fill(query);
    await search.getByRole("textbox").press("Enter");
  }

  async gotoMember(sampleIdentifier: string): Promise<void> {
    await this.page.goto(this.memberUrl(sampleIdentifier));
  }

  async expectCollection(query: string): Promise<void> {
    await this.expectCollectionUrl(query);
    await expect(
      this.page.getByRole("heading", { level: 1, name: "Surveillance" }),
    ).toBeVisible();
    await expect(
      this.page
        .getByRole("banner")
        .getByRole("combobox", { name: "Search type" }),
    ).toContainText("Surveillance");
    await expect(
      this.page.getByRole("banner").getByRole("textbox"),
    ).toHaveValue(query);
    await expect(this.collectionKeyword).toHaveValue("");
  }

  async expectCollectionUrl(query: string): Promise<void> {
    await expect(this.page).toHaveURL(
      `/surveillance?keyword=${encodeURIComponent(query)}`,
    );
  }

  memberLink(sampleIdentifier: string): Locator {
    return this.page.getByRole("link", {
      name: sampleIdentifier,
      exact: true,
    });
  }

  async filterCollection(query: string): Promise<void> {
    await this.collectionKeyword.fill(query);
  }

  async expectMemberVisible(sampleIdentifier: string): Promise<void> {
    await expect(this.memberLink(sampleIdentifier)).toBeVisible();
  }

  async selectFacet(name: string): Promise<void> {
    await this.page.getByRole("button", { name: "Show Filters" }).click();
    await this.page.getByRole("button", { name }).click();
  }

  async openMember(
    sampleIdentifier: string,
    pathogenTestType: string,
  ): Promise<void> {
    await this.memberLink(sampleIdentifier).click();
    await expect(this.page).toHaveURL(
      this.memberUrl(sampleIdentifier, pathogenTestType),
    );
  }

  async expectOverview(): Promise<void> {
    await expect(
      this.page.getByRole("heading", { level: 1, name: "sample/1" }),
    ).toBeVisible();
    await this.expectSectionValue("Sample Info", "Nasal swab");
    await this.expectSectionValue("Collection", "2024-07");
    await this.expectSectionValue("Collection", "33.45° S, 151.2° E");
    await this.expectSectionValue("Tests", "RAT/antigen");
    await this.expectSectionValue("Host", "Human");
  }

  async expectAmbiguityChoices(...testTypes: string[]): Promise<void> {
    await expect(
      this.page.getByRole("heading", { name: "Choose a pathogen test" }),
    ).toBeVisible();
    for (const testType of testTypes) {
      await expect(
        this.page.getByRole("link", { name: testType, exact: true }),
      ).toBeVisible();
    }
  }

  async expectAmbiguityChoiceLink(
    sampleIdentifier: string,
    testType: string,
  ): Promise<void> {
    await expect(
      this.page.getByRole("link", { name: testType, exact: true }),
    ).toHaveAttribute(
      "href",
      this.memberUrl(sampleIdentifier, testType),
    );
  }

  async chooseAmbiguityChoice(
    sampleIdentifier: string,
    testType: string,
  ): Promise<void> {
    await this.page.getByRole("link", { name: testType, exact: true }).click();
    await expect(this.page).toHaveURL(
      this.memberUrl(sampleIdentifier, testType),
    );
    await expect(
      this.page.getByRole("heading", {
        level: 1,
        name: sampleIdentifier,
        exact: true,
      }),
    ).toBeVisible();
  }

  private memberUrl(sampleIdentifier: string, testType?: string): string {
    const path = `/surveillance/${encodeURIComponent(sampleIdentifier)}`;
    return testType === undefined
      ? path
      : `${path}?pathogen_test_type=${encodeURIComponent(testType)}`;
  }

  private async expectSectionValue(
    sectionName: string,
    value: string,
  ): Promise<void> {
    const section = this.page
      .getByText(sectionName, { exact: true })
      .locator("xpath=ancestor::*[.//dl][1]");
    await expect(section.getByText(value, { exact: true })).toBeVisible();
  }
}
