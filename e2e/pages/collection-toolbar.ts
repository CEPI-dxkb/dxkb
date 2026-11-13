import { expect, type Locator, type Page } from "@playwright/test";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A resource collection's one-row filter toolbar (`role=toolbar` "Filters"),
 * rendered by every collection page.
 */
export class CollectionToolbar {
  constructor(readonly page: Page) {}

  root(): Locator {
    return this.page.getByRole("toolbar", { name: "Filters" });
  }

  keyword(): Locator {
    return this.root().getByRole("searchbox", { name: "Search keywords" });
  }

  async fillKeyword(text: string): Promise<void> {
    await this.keyword().fill(text);
  }

  filtersButton(): Locator {
    return this.root().getByRole("button", {
      name: /^Filters(?:, \d+ active)?$/,
    });
  }

  facetList(): Locator {
    return this.page.getByRole("listbox", { name: "Filters" });
  }

  facetSearch(): Locator {
    return this.page.getByRole("combobox", { name: "Find a filter or value" });
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

  facetOption(label: string): Locator {
    return this.facetList().getByRole("option", {
      name: new RegExp(`^${escapeRegExp(label)}(?::|,|$)`),
    });
  }

  async openFacet(label: string): Promise<void> {
    await this.openFilters();
    const option = this.facetOption(label);
    await option.click();
    await expect(option).toHaveAttribute("aria-selected", "true");
  }

  valueList(label: string): Locator {
    return this.page.getByRole("listbox", { name: `${label} values` });
  }

  /**
   * With `count`, only the option showing exactly that count matches; without
   * it, any count does.
   */
  facetValueOption(label: string, value: string, count?: number): Locator {
    const countPattern =
      count === undefined ? "(?: \\S+)?" : ` ${escapeRegExp(count.toLocaleString("en-US"))}`;
    return this.valueList(label).getByRole("option", {
      name: new RegExp(`^${escapeRegExp(value)}${countPattern}$`),
    });
  }

  valuePlaceholders(label: string): Locator {
    return this.valueList(label).locator('[data-slot="skeleton"]');
  }

  noValues(label: string): Locator {
    return this.valueList(label).getByText("No values in these results");
  }

  favoriteToggle(): Locator {
    return this.page.getByRole("button", { name: /^Favorite(?:d)?$/ });
  }

  async pickFacetValue(label: string, value: string): Promise<void> {
    await this.openFacet(label);
    const option = this.facetValueOption(label, value);
    await option.click();
    await expect(option).toHaveAttribute("aria-selected", "true");
  }

  /**
   * Records every `aria-selected` state a value option shows, sampled each
   * animation frame from now on, so a pick that blinks off for a moment is
   * caught. The returned function stops the sampling and gives the states in
   * order, consecutive repeats collapsed ("missing" while the option is gone).
   */
  async watchValueSelection(
    label: string,
    value: string,
  ): Promise<() => Promise<string[]>> {
    const watcher = await this.page.evaluateHandle(
      ([listLabel, optionValue]) => {
        const states: string[] = [];
        let stopped = false;
        const sample = () => {
          if (stopped) return;
          const list = [
            ...document.querySelectorAll('[role="listbox"]'),
          ].find((element) => element.getAttribute("aria-label") === listLabel);
          const option = [
            ...(list?.querySelectorAll('[role="option"]') ?? []),
          ].find(
            (element) =>
              element.querySelector("span[title]")?.getAttribute("title") ===
              optionValue,
          );
          const state = option?.getAttribute("aria-selected") ?? "missing";
          if (states.at(-1) !== state) states.push(state);
          requestAnimationFrame(sample);
        };
        sample();
        return {
          states,
          stop: () => {
            stopped = true;
          },
        };
      },
      [`${label} values`, value] as const,
    );
    return () =>
      watcher.evaluate((recorded) => {
        recorded.stop();
        return recorded.states;
      });
  }

  /** Every active filter's pill, whichever facet it belongs to. */
  activeFilterPills(): Locator {
    return this.root().getByRole("button", { name: /: .*\. Edit filter$/ });
  }

  /** The "+N" button the pills past the toolbar's width fold into. */
  moreFiltersButton(): Locator {
    return this.root().getByRole("button", {
      name: /^\d+ more filters: .*\. Open in the Filters menu$/,
    });
  }

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

  /** The chip for a hand-written `rql`; it opens a popover with the query. */
  advancedQueryChip(): Locator {
    return this.root().getByRole("button", {
      name: "Advanced query. Show details",
      exact: true,
    });
  }

  /** Filtered by text: Next's route announcer is an alert too. */
  facetError(): Locator {
    return this.root()
      .getByRole("alert")
      .filter({ hasText: "Could not load filter values" });
  }

  async retryFacets(): Promise<void> {
    await this.root().getByRole("button", { name: "Retry", exact: true }).click();
  }

  columnsButton(): Locator {
    return this.root().getByRole("button", { name: /^Columns \d+\/\d+ shown/ });
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

  columnOption(label: string): Locator {
    return this.columnList().getByRole("option", {
      name: new RegExp(`^${escapeRegExp(label)}, (?:shown|hidden)`),
    });
  }

  async toggleColumn(label: string): Promise<void> {
    await this.openColumnsIfClosed();
    await this.columnOption(label).click();
  }

  private async openColumnsIfClosed(): Promise<void> {
    if (await this.columnList().isVisible()) return;
    await this.openColumns();
  }
}
