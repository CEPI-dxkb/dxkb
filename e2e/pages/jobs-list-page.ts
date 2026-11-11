import { expect, type Page, type Locator } from "@playwright/test";

import { expectUrlParams } from "../support/url-params";
import { ErrorAlert } from "./error-alert";
import { PanelSplit } from "./panel-split";

/**
 * Page object for the `/jobs` list; rows are matched by `job.id`, which
 * renders verbatim in the id column.
 */
export class JobsListPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly statusTrigger: Locator;
  readonly panels: PanelSplit;
  readonly loadError: ErrorAlert;
  readonly statusPillUnavailable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { level: 1, name: /^jobs$/i });
    this.loadError = new ErrorAlert(page, "Could not load jobs");
    this.statusPillUnavailable = page.getByRole("button", {
      name: "Job status unavailable",
    });
    this.searchInput = page.getByPlaceholder(/search by name, id, or service/i);
    // Named by the trigger's aria-label, so it is the same element whichever
    // status is chosen.
    this.statusTrigger = page.getByRole("combobox", {
      name: "Filter by status",
    });
    this.panels = new PanelSplit(page);
  }

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
    // Skeleton and empty rows are server-rendered, so this can pass before
    // hydration; use waitForJob first.
    await expect(this.page.locator("tbody tr").first()).toBeVisible();
  }

  /**
   * Jobs load client-side, so a real row proves hydration; a click made
   * earlier is lost.
   */
  async waitForJob(jobId: string): Promise<void> {
    await expect(this.rowById(jobId)).toBeVisible();
  }

  async selectJob(jobId: string): Promise<void> {
    await this.rowById(jobId).click();
  }

  /**
   * The trigger is matched by its accessible name, which stays "Filter by
   * status" once a status is chosen, so a second call works.
   */
  async filterByStatus(label: string | RegExp): Promise<void> {
    await this.statusTrigger.click();
    await this.page.getByRole("option", { name: label }).click();
  }

  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
  }

  async expectUrlParams(
    expected: Record<string, string | null>,
  ): Promise<void> {
    await expectUrlParams(this.page, expected);
  }

  async expectStatus(label: string): Promise<void> {
    // Contains, not equals: the trigger also renders a chevron glyph.
    await expect(this.statusTrigger).toContainText(label);
  }

  async expectSearch(term: string): Promise<void> {
    await expect(this.searchInput).toHaveValue(term);
  }

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

  async sortBy(label: string): Promise<void> {
    await this.sortButton(label).click();
  }

  /**
   * The table sets no `aria-sort`; the sort button's lucide arrow shows the
   * direction.
   */
  async sortState(label: string): Promise<"ascending" | "descending" | "none"> {
    const iconClasses =
      (await this.sortButton(label).locator("svg").getAttribute("class")) ?? "";
    const tokens = iconClasses.split(/\s+/);
    if (tokens.includes("lucide-arrow-up")) return "ascending";
    if (tokens.includes("lucide-arrow-down")) return "descending";
    if (tokens.includes("lucide-arrow-up-down")) return "none";
    // An icon rename must fail loudly, not read as "unsorted".
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
   * The menu link uses the client router, so Back afterwards is a popstate.
   * The menu opens in a portal, scoped via the trigger's `aria-controls`.
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

  async killSelected(): Promise<void> {
    await this.page.getByRole("button", { name: /^kill$/i }).click();
  }

  /**
   * Named "Resize <label> column" to tell it apart from the panel separator.
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

  async columnWidth(label: string): Promise<number> {
    const box = await this.columnHeader(label).boundingBox();
    return Math.round(box?.width ?? 0);
  }

  async columnLeft(label: string): Promise<number> {
    const box = await this.columnHeader(label).boundingBox();
    if (!box) throw new Error(`${label} column header not rendered`);
    return box.x;
  }

  async columnSetting(label: string): Promise<number> {
    return Number(
      await this.columnResizeHandle(label).getAttribute("aria-valuenow"),
    );
  }

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
   * Polls: a saved width is read after hydration; a pixel of rounding is
   * tolerated, more is a reset.
   */
  async expectColumnWidth(label: string, expected: number): Promise<void> {
    await expect
      .poll(async () => Math.abs((await this.columnWidth(label)) - expected))
      .toBeLessThanOrEqual(2);
  }
}
