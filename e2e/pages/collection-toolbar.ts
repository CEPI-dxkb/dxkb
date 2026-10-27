import { expect, type Locator, type Page } from "@playwright/test";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A resource collection's one-row filter toolbar (`role=toolbar` "Filters"):
 * the keyword box, the Filters menu (facets on the left, the current facet's
 * values on the right), active filter pills, Clear all and the Columns menu.
 * Every collection page (canonical views and taxon tabs) renders the same one.
 */
export class CollectionToolbar {
  constructor(readonly page: Page) {}

  root(): Locator {
    return this.page.getByRole("toolbar", { name: "Filters" });
  }

  /** The collection's own keyword box (not the navbar search). */
  keyword(): Locator {
    return this.root().getByRole("searchbox", { name: "Search keywords" });
  }

  async fillKeyword(text: string): Promise<void> {
    await this.keyword().fill(text);
  }

  // -- Filters menu ---------------------------------------------------------

  /** "Filters", or "Filters, N active" once something is filtered. */
  filtersButton(): Locator {
    return this.root().getByRole("button", {
      name: /^Filters(?:, \d+ active)?$/,
    });
  }

  /** The menu's left pane: every facet, grouped Active · Facets · More. */
  facetList(): Locator {
    return this.page.getByRole("listbox", { name: "Facets" });
  }

  /** The menu's search over facet names and loaded values. */
  facetSearch(): Locator {
    return this.page.getByRole("combobox", { name: "Find a facet or value" });
  }

  async openFilters(): Promise<void> {
    if (await this.facetList().isVisible()) return;
    await this.filtersButton().click();
    await expect(this.facetList()).toBeVisible();
  }

  async closeFilters(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await expect(this.facetList()).toHaveCount(0);
  }

  /**
   * A facet's row in the left pane. Its name is the label, then any applied
   * values (": Complete") and ", pinned".
   */
  facetOption(label: string): Locator {
    return this.facetList().getByRole("option", {
      name: new RegExp(`^${escapeRegExp(label)}(?::|,|$)`),
    });
  }

  /** Rows of the pinned facets: the set whose counts load when the menu opens. */
  pinnedFacetOptions(): Locator {
    return this.facetList().getByRole("option", { name: /, pinned$/ });
  }

  /** The folded More group's header ("Show 12 more facets"). */
  moreFacetsToggle(): Locator {
    return this.facetList().getByRole("option", {
      name: /^(?:Show|Hide) \d+ more facets?$/,
    });
  }

  /** Show a facet's values on the right, unfolding More when it sits there. */
  async openFacet(label: string): Promise<void> {
    await this.openFilters();
    const option = this.facetOption(label);
    if (!(await option.isVisible())) {
      const toggle = this.moreFacetsToggle();
      await expect(toggle).toHaveAccessibleName(/^Show /);
      await toggle.click();
    }
    await option.click();
    await expect(option).toHaveAttribute("aria-selected", "true");
  }

  /** A facet's checklist: the menu's right pane, or a pill's popover. */
  valueList(label: string): Locator {
    return this.page.getByRole("listbox", { name: `${label} values` });
  }

  /**
   * One value in a facet's checklist. With `count`, only the option showing
   * exactly that count matches ("Complete 5"); without it, any count does.
   */
  facetValueOption(label: string, value: string, count?: number): Locator {
    const countPattern =
      count === undefined ? "(?: \\S+)?" : ` ${escapeRegExp(count.toLocaleString("en-US"))}`;
    return this.valueList(label).getByRole("option", {
      name: new RegExp(`^${escapeRegExp(value)}${countPattern}$`),
    });
  }

  /** Placeholder rows a checklist shows while its facet's counts load. */
  valuePlaceholders(label: string): Locator {
    return this.valueList(label).locator('[data-slot="skeleton"]');
  }

  /** A checklist's empty state: its facet was counted and has no values. */
  noValues(label: string): Locator {
    return this.valueList(label).getByText("No values in these results");
  }

  /** The current facet's Pin toggle ("Pin" / "Pinned", aria-pressed). */
  pinToggle(): Locator {
    return this.page.getByRole("button", { name: /^Pin(?:ned)?$/ });
  }

  /** Tick a facet value in the Filters menu (opening it on that facet). */
  async pickFacetValue(label: string, value: string): Promise<void> {
    await this.openFacet(label);
    const option = this.facetValueOption(label, value);
    await option.click();
    await expect(option).toHaveAttribute("aria-selected", "true");
  }

  // -- Pills, Clear all, errors ---------------------------------------------

  /** An applied filter's pill, "<Label>: <values>. Edit filter". */
  activeFilterPill(label: string): Locator {
    return this.root().getByRole("button", {
      name: new RegExp(`^${escapeRegExp(label)}: .*\\. Edit filter$`),
    });
  }

  async clearFilter(label: string): Promise<void> {
    await this.root()
      .getByRole("button", { name: `Clear ${label} filter`, exact: true })
      .click();
  }

  clearAllButton(): Locator {
    return this.root().getByRole("button", { name: "Clear all", exact: true });
  }

  async clearAll(): Promise<void> {
    await this.clearAllButton().click();
  }

  /** The toolbar's count error. Filtered by text: Next's route announcer is an alert too. */
  facetError(): Locator {
    return this.root()
      .getByRole("alert")
      .filter({ hasText: "Could not load filter values" });
  }

  async retryFacets(): Promise<void> {
    await this.root().getByRole("button", { name: "Retry", exact: true }).click();
  }

  // -- Columns menu ---------------------------------------------------------

  /** "Columns, 8 of 20 shown[, customised]". */
  columnsButton(): Locator {
    return this.root().getByRole("button", { name: /^Columns, \d+ of \d+ shown/ });
  }

  columnList(): Locator {
    return this.page.getByRole("listbox", { name: "Columns" });
  }

  async openColumns(): Promise<void> {
    await this.columnsButton().click();
    await expect(this.columnList()).toBeVisible();
  }

  async closeColumns(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await expect(this.columnList()).toHaveCount(0);
  }

  /** A column's row: "<Label>, shown, position n of m" or "<Label>, hidden". */
  columnOption(label: string): Locator {
    return this.columnList().getByRole("option", {
      name: new RegExp(`^${escapeRegExp(label)}, (?:shown|hidden)`),
    });
  }

  /** Show or hide a column from the Columns menu (which stays open). */
  async toggleColumn(label: string): Promise<void> {
    await this.openColumnsIfClosed();
    await this.columnOption(label).click();
  }

  private async openColumnsIfClosed(): Promise<void> {
    if (await this.columnList().isVisible()) return;
    await this.openColumns();
  }
}
