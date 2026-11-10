import { expect, type Page, type Locator } from "@playwright/test";

/**
 * Page object for service forms; for interactions not covered here, use
 * `page` directly (WorkspaceObjectSelector has too many service-specific
 * quirks for one helper).
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

  async submit(submitLabel: string | RegExp): Promise<void> {
    await this.page.getByRole("button", { name: submitLabel }).click();
  }
}
