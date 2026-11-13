import { expect, type Page } from "@playwright/test";
import { CollectionToolbar } from "./collection-toolbar";

export class ResourceCollectionPage {
  readonly toolbar: CollectionToolbar;

  constructor(
    readonly page: Page,
    readonly route: string,
    readonly resource: string,
    readonly selectedId: string,
    readonly detailText: string,
  ) {
    this.toolbar = new CollectionToolbar(page);
  }

  async goto(keyword: string) {
    await this.gotoQuery(`keyword=${encodeURIComponent(keyword)}`);
  }

  /** Opens the collection at a raw query string (`rql=...`), as a shared link carries it. */
  async gotoQuery(query: string) {
    await this.page.goto(`/${this.route}?${query}`);
    await expect(
      this.page.getByRole("checkbox", { name: `Select row ${this.selectedId}` }),
    ).toBeVisible();
  }

  async selectRow() {
    await this.page
      .getByRole("checkbox", { name: `Select row ${this.selectedId}` })
      .check();
    await this.expectSelectionPreserved();
  }

  async goToPage(pageNumber: number) {
    await this.page
      .getByRole("navigation", { name: `${this.resource} results pagination` })
      .getByRole("button", { name: String(pageNumber), exact: true })
      .click();
    if (pageNumber === 1) {
      await expect(this.page).not.toHaveURL(/[?&]page=/);
    } else {
      await expect(this.page).toHaveURL(
        new RegExp(`[?&]page=${String(pageNumber)}(?:&|$)`),
      );
    }
  }

  async expectSelectionPreserved() {
    await expect(this.page.getByText("1 selected", { exact: true })).toBeVisible();
    await expect(this.page.getByRole("button", { name: "Hide" })).toBeVisible();
    await expect(this.page.getByText(this.detailText, { exact: true }).first()).toBeVisible();
  }

  rowCheckbox(id: string) {
    return this.page.getByRole("checkbox", { name: `Select row ${id}` });
  }

  /**
   * Found by position: its name follows what a click would do ("Select all
   * rows on this page", ...).
   */
  headerCheckbox() {
    return this.page.getByRole("columnheader").getByRole("checkbox");
  }

  tableRegion() {
    return this.page.getByRole("region", { name: /results table$/ });
  }

  rowSkeletons() {
    return this.tableRegion().locator('tbody [data-slot="skeleton"]');
  }

  selectionCellSkeleton() {
    return this.tableRegion()
      .locator("tbody tr")
      .first()
      .locator("td")
      .first()
      .locator('[data-slot="skeleton"]');
  }

  pager() {
    return this.page.getByRole("navigation", {
      name: `${this.resource} results pagination`,
    });
  }

  resultRange(first: number, last: number, total: number) {
    return this.page.getByText(
      `Showing ${String(first)}-${String(last)} of ${String(total)} results`,
    );
  }

  async selectAllResults(total: number) {
    await this.page
      .getByRole("button", {
        name: `Select all ${String(total)} results across all pages`,
      })
      .click();
  }

  allResultsSelectedCount(total: number) {
    return this.page.getByText(`All ${String(total)} selected`, {
      exact: true,
    });
  }

  allResultsSelectedNotice(total: number) {
    return this.page.getByText(
      `All ${String(total)} results are selected across all pages.`,
    );
  }

  actionTile(label: string) {
    return this.page.getByRole("button", { name: label, exact: true });
  }

  actionDialog(name: string) {
    return this.page.getByRole("dialog", { name });
  }

  /**
   * Opens `tile`'s dialog, closes it with Escape and checks focus is back on
   * the tile (GROUP and SERVICES are disabled while IDs resolve, which drops
   * focus to the body).
   */
  async expectEscapeReturnsFocusToTile(tile: string, dialog: string) {
    await this.actionTile(tile).click();
    const opened = this.actionDialog(dialog);
    await expect(opened).toBeVisible();
    await this.page.keyboard.press("Escape");
    await expect(opened).toBeHidden();
    await expect(this.actionTile(tile)).toBeFocused();
  }

  downloadTile() {
    return this.page.getByRole("button", { name: /^DOWNLOAD/ });
  }

  downloadPanel() {
    return this.page
      .getByRole("dialog")
      .filter({ has: this.page.getByRole("radiogroup", { name: "Rows to download" }) });
  }

  async openDownload() {
    await this.downloadTile().click();
    await expect(this.downloadPanel()).toBeVisible();
  }

  downloadScope(scope: "Selected" | "All") {
    return this.downloadPanel().getByRole("radio", {
      name: new RegExp(`^${scope}`),
    });
  }

  /** A disabled row's name continues with its reason, so match on the start. */
  downloadFormat(label: string) {
    return this.downloadPanel().getByRole("button", {
      name: new RegExp(`^${label}`),
    });
  }

  async expectSelectedRowChecked() {
    await expect(
      this.page.getByRole("checkbox", { name: `Select row ${this.selectedId}` }),
    ).toBeChecked();
  }
}
