import { expect, type Page } from "@playwright/test";
import { CollectionToolbar } from "./collection-toolbar";

export class ResourceCollectionPage {
  /** The filter toolbar above the table: keyword, Filters, pills, Columns. */
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
    await this.page.goto(`/${this.route}?keyword=${encodeURIComponent(keyword)}`);
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
   * The selection column's header checkbox. Its name follows what a click would do
   * ("Select all rows on this page", "Deselect all results", ...), so it is found by
   * where it sits instead.
   */
  headerCheckbox() {
    return this.page.getByRole("columnheader").getByRole("checkbox");
  }

  /** The table's scroll region; its body holds the rows or the loading skeleton. */
  tableRegion() {
    return this.page.getByRole("region", { name: /results table$/ });
  }

  /** Skeleton rows the table shows while the page on screen is loading. */
  rowSkeletons() {
    return this.tableRegion().locator('tbody [data-slot="skeleton"]');
  }

  /** The selection column's skeleton in the first loading row. */
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

  /** The footer's range, like "Showing 401-600 of 650 results". */
  resultRange(first: number, last: number, total: number) {
    return this.page.getByText(
      `Showing ${String(first)}-${String(last)} of ${String(total)} results`,
    );
  }

  /** From the page-selected banner, select every matching result. */
  async selectAllResults(total: number) {
    await this.page
      .getByRole("button", {
        name: `Select all ${String(total)} results across all pages`,
      })
      .click();
  }

  /** The action bar's count while every matching result is selected. */
  allResultsSelectedCount(total: number) {
    return this.page.getByText(`All ${String(total)} selected`, {
      exact: true,
    });
  }

  /** The banner that confirms every matching result is selected. */
  allResultsSelectedNotice(total: number) {
    return this.page.getByText(
      `All ${String(total)} results are selected across all pages.`,
    );
  }

  /** The action rail's Download tile; its name ends in the selection badge. */
  downloadTile() {
    return this.page.getByRole("button", { name: /^DOWNLOAD/ });
  }

  /** The Download tile's popover. */
  downloadPanel() {
    return this.page
      .getByRole("dialog")
      .filter({ has: this.page.getByRole("radiogroup", { name: "Rows to download" }) });
  }

  async openDownload() {
    await this.downloadTile().click();
    await expect(this.downloadPanel()).toBeVisible();
  }

  /** A scope radio, "Selected" or "All", named with its count. */
  downloadScope(scope: "Selected" | "All") {
    return this.downloadPanel().getByRole("radio", {
      name: new RegExp(`^${scope}`),
    });
  }

  /**
   * A format row ("Text", "CSV", "Excel", "DNA FASTA", "Protein FASTA"). A
   * disabled row's name goes on with its reason, so the match is on the start.
   */
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
