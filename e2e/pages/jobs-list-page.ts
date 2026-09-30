import { expect, type Page, type Locator } from "@playwright/test";

import { expectUrlParams } from "../support/url-params";
import { PanelSplit } from "./panel-split";

/**
 * Page object for the `/jobs` list view. Covers the heading, the status, search and date
 * filters, column sorting, the query params they keep in the address, row selection, the
 * details panel that appears on click, the KILL action, and the column resize handles. Rows are
 * matched by `job.id` which renders verbatim in the table's id column.
 */
export class JobsListPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly statusTrigger: Locator;
  readonly panels: PanelSplit;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { level: 1, name: /^jobs$/i });
    this.searchInput = page.getByPlaceholder(/search by name, id, or service/i);
    // Named by the trigger's aria-label, so it is the same element whichever
    // status is chosen (its visible text changes from "All Status").
    this.statusTrigger = page.getByRole("combobox", {
      name: "Filter by status",
    });
    this.panels = new PanelSplit(page);
  }

  /** Open the list; `query` is a raw query string (e.g. "?status=failed") for a shared link. */
  async goto(query = ""): Promise<void> {
    await this.page.goto(`/jobs${query}`);
    await expect(this.heading).toBeVisible();
  }

  rowById(jobId: string): Locator {
    return this.page.getByRole("row").filter({
      has: this.page.getByRole("cell", { name: jobId, exact: true }),
    });
  }

  async waitForRows(): Promise<void> {
    // Any tbody row. The DataTable's skeleton and empty rows are server-rendered, so
    // this can pass before hydration; use waitForJob before interacting.
    await expect(this.page.locator("tbody tr").first()).toBeVisible();
  }

  /**
   * A job's row is on screen. Jobs are fetched client-side, so a real row proves the
   * page has hydrated: a click made before that (a Select trigger, say) is lost.
   */
  async waitForJob(jobId: string): Promise<void> {
    await expect(this.rowById(jobId)).toBeVisible();
  }

  async selectJob(jobId: string): Promise<void> {
    await this.rowById(jobId).click();
  }

  /**
   * Filter the table by one of the status dropdown values. The page has multiple comboboxes
   * (the banner search dropdown, the service filter, and this one), so the trigger is matched
   * by its accessible name, which stays "Filter by status" once a status is chosen. That lets
   * a second call change the status again.
   */
  async filterByStatus(label: string | RegExp): Promise<void> {
    await this.statusTrigger.click();
    await this.page.getByRole("option", { name: label }).click();
  }

  /** Type into the search box. The URL's `q` follows after the debounce, not per keystroke. */
  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
  }

  /** Polls the address for the given query params (`null` = absent). */
  async expectUrlParams(
    expected: Record<string, string | null>,
  ): Promise<void> {
    await expectUrlParams(this.page, expected);
  }

  /** The status trigger shows the chosen option (its label, e.g. "Completed"). */
  async expectStatus(label: string): Promise<void> {
    // Contains, not equals: the trigger also renders a chevron glyph after the label.
    await expect(this.statusTrigger).toContainText(label);
  }

  async expectSearch(term: string): Promise<void> {
    await expect(this.searchInput).toHaveValue(term);
  }

  /**
   * The date filter's trigger reads its applied range, e.g.
   * "Between Sep 1, 2026 → Sep 10, 2026", or "All dates" when none is set.
   */
  async expectDateFilter(label: string): Promise<void> {
    await expect(
      this.page.getByRole("button", { name: label, exact: true }),
    ).toBeVisible();
  }

  private sortButton(label: string): Locator {
    return this.page.getByRole("button", {
      name: `Sort by ${label}`,
      exact: true,
    });
  }

  /** Click a column's sort button (first click sorts ascending). */
  async sortBy(label: string): Promise<void> {
    await this.sortButton(label).click();
  }

  /**
   * A column's sort direction. The jobs table sets no `aria-sort`; its sort button shows a
   * lucide arrow instead: up-down (unsorted), up (ascending) or down (descending).
   */
  async sortState(label: string): Promise<"ascending" | "descending" | "none"> {
    const iconClasses =
      (await this.sortButton(label).locator("svg").getAttribute("class")) ?? "";
    const tokens = iconClasses.split(/\s+/);
    if (tokens.includes("lucide-arrow-up")) return "ascending";
    if (tokens.includes("lucide-arrow-down")) return "descending";
    if (tokens.includes("lucide-arrow-up-down")) return "none";
    // An icon rename must fail loudly, not read as "unsorted" and pass a "none" check.
    throw new Error(
      `Sort button for "${label}" shows an unrecognised icon (class="${iconClasses}")`,
    );
  }

  async expectSort(
    label: string,
    state: "ascending" | "descending" | "none",
  ): Promise<void> {
    await expect.poll(() => this.sortState(label)).toBe(state);
  }

  /**
   * Leave through the navbar's Workspace menu, Home. The menu link goes through the client
   * router, so Back afterwards is a Next popstate, not a document load. The menu opens in a
   * portal outside the banner; the trigger's `aria-controls` names it once open, which scopes
   * "Home" to this menu so another "Home" link on the page cannot make it ambiguous.
   */
  async openWorkspaceHomeFromNavbar(): Promise<void> {
    const trigger = this.page
      .getByRole("banner")
      .getByRole("button", { name: "Workspace", exact: true });
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-controls", /\S/);
    const menuId = (await trigger.getAttribute("aria-controls")) ?? "";
    await this.page
      .locator(`[id="${menuId}"]`)
      .getByRole("link", { name: "Home", exact: true })
      .click();
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
