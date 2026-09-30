import { expect, type Page, type Locator } from "@playwright/test";

import { PanelSplit } from "./panel-split";

/**
 * Page object for the `/jobs` list view. Covers the heading, status filter, row selection, the
 * details panel that appears on click, the KILL action, and the column resize handles. Rows are
 * matched by `job.id` which renders verbatim in the table's id column.
 */
export class JobsListPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly panels: PanelSplit;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { level: 1, name: /^jobs$/i });
    this.searchInput = page.getByPlaceholder(/search by name, id, or service/i);
    this.panels = new PanelSplit(page);
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

  /**
   * The drag handle on a column header. FileTable renders it as a vertical
   * separator named "Resize <label> column"; the name keeps it apart from the
   * panel separator, which is also a separator.
   */
  private columnResizeHandle(label: string): Locator {
    return this.page.getByRole("separator", {
      name: `Resize ${label} column`,
      exact: true,
    });
  }

  private columnHeader(label: string): Locator {
    return this.page
      .getByRole("columnheader")
      .filter({ has: this.columnResizeHandle(label) });
  }

  /**
   * The column's width setting in px, read from its resize handle (`aria-valuenow`).
   * Unlike the rendered width, it does not include the table stretching to fill its pane.
   */
  async columnSize(label: string): Promise<number> {
    const value =
      await this.columnResizeHandle(label).getAttribute("aria-valuenow");
    return Number(value);
  }

  /** Rendered width of a column header in whole pixels. */
  async columnWidth(label: string): Promise<number> {
    const box = await this.columnHeader(label).boundingBox();
    return Math.round(box?.width ?? 0);
  }

  /** Drag a column's resize handle horizontally; positive widens the column. */
  async dragColumnHandle(label: string, deltaX: number): Promise<void> {
    const box = await this.columnResizeHandle(label).boundingBox();
    if (!box) throw new Error(`resize handle for ${label} not rendered`);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await this.page.mouse.move(x, y);
    await this.page.mouse.down();
    await this.page.mouse.move(x + deltaX, y, { steps: 8 });
    await this.page.mouse.up();
  }

  /**
   * Polls: a saved width is read after hydration, so it can land a render after
   * the rows do. Sub-pixel rounding can move a column by a pixel; anything more
   * is a reset.
   */
  async expectColumnWidth(label: string, expected: number): Promise<void> {
    await expect
      .poll(async () => Math.abs((await this.columnWidth(label)) - expected))
      .toBeLessThanOrEqual(2);
  }
}
