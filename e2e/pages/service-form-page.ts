import { expect, type Page, type Locator } from "@playwright/test";

/**
 * Page object for bioinformatics service forms (e.g. `/services/genome-assembly`).
 * Specs that need to drive a form interaction not covered here should reach for the underlying
 * Playwright `page` directly rather than expanding this object with helpers that no real test
 * exercises — the WorkspaceObjectSelector in particular has too many service-specific quirks
 * (async dropdowns, portal listboxes, paired vs. single inputs) for a single shared helper.
 */
export class ServiceFormPage {
  readonly page: Page;
  readonly heading: Locator;

  constructor(page: Page, headingText: string | RegExp) {
    this.page = page;
    this.heading = page.getByRole("heading", { level: 1, name: headingText });
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path);
    await expect(this.heading).toBeVisible();
  }

  /** Click the primary submit button by its visible label. */
  async submit(submitLabel: string | RegExp): Promise<void> {
    await this.page.getByRole("button", { name: submitLabel }).click();
  }
}
