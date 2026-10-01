import { expect, type Page } from "@playwright/test";

export class ResourceCollectionPage {
  constructor(
    readonly page: Page,
    readonly route: string,
    readonly resource: string,
    readonly selectedId: string,
    readonly detailText: string,
  ) {}

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

  async showFilters() {
    await this.page.getByRole("button", { name: "Show Filters" }).click();
  }

  facetChooserTrigger() {
    return this.page.getByRole("button", { name: "Facets" });
  }

  async openFacetChooser() {
    await this.facetChooserTrigger().click();
  }

  async closeFacetChooser() {
    await this.page.keyboard.press("Escape");
  }

  facetOption(label: string) {
    return this.page.getByRole("menuitemcheckbox", { name: label });
  }

  /** The chooser's checked entries: the facets the panel shows. */
  checkedFacetOptions() {
    return this.page.getByRole("menuitemcheckbox", { checked: true });
  }

  /** A facet value button, named like "Complete (5)". */
  facetValue(name: string) {
    return this.page.getByRole("button", { name, exact: true });
  }

  /** Facet columns that have no counted values. */
  emptyFacetColumns() {
    return this.page.getByText("No values");
  }

  /** The filter panel while its counts belong to a previous scope or facet set. */
  staleFacetPanel() {
    return this.page.locator('[data-stale][aria-busy="true"]');
  }

  /** Placeholders in the stale panel for facets that are not counted yet. */
  staleFacetPlaceholders() {
    return this.staleFacetPanel().locator('[data-slot="skeleton"]');
  }

  /** The filter panel's error. Filtered by text: Next's route announcer is an alert too. */
  facetError() {
    return this.page
      .getByRole("alert")
      .filter({ hasText: "Could not load filter values" });
  }

  async retryFacets() {
    await this.page.getByRole("button", { name: "Retry", exact: true }).click();
  }

  async expectSelectedRowChecked() {
    await expect(
      this.page.getByRole("checkbox", { name: `Select row ${this.selectedId}` }),
    ).toBeChecked();
  }
}
