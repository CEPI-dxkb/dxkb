import { expect, type Page, type Locator } from "@playwright/test";

/**
 * Page object for the `/jobs` list view. Covers the heading, status filter, row selection, the
 * details panel that appears on click, and the KILL action. Rows are matched by `job.id` which
 * renders verbatim in the table's id column.
 */
export class JobsListPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { level: 1, name: /^jobs$/i });
    this.searchInput = page.getByPlaceholder(/search by name, id, or service/i);
  }

  async goto(): Promise<void> {
    await this.page.goto("/jobs");
    await expect(this.heading).toBeVisible();
  }

  rowById(jobId: string): Locator {
    return this.page.getByRole("row").filter({
      has: this.page.getByRole("cell", { name: jobId, exact: true }),
    });
  }

  async waitForRows(): Promise<void> {
    // Any data row in tbody means the list has hydrated.
    await expect(this.page.locator("tbody tr").first()).toBeVisible();
  }

  async selectJob(jobId: string): Promise<void> {
    await this.rowById(jobId).click();
  }

  /**
   * Filter the table by one of the status dropdown values. The page has multiple comboboxes
   * (the banner search dropdown, the service filter, and this one), so we match the trigger by
   * its placeholder-derived accessible text ("All Status") rather than positional index.
   */
  async filterByStatus(label: string | RegExp): Promise<void> {
    const statusTrigger = this.page
      .getByRole("combobox")
      .filter({ hasText: /all status/i });
    await statusTrigger.click();
    await this.page.getByRole("option", { name: label }).click();
  }

  /** Click the KILL action on the currently selected row. */
  async killSelected(): Promise<void> {
    await this.page.getByRole("button", { name: /^kill$/i }).click();
  }
}
