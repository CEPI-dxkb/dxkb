import { expect, type Page } from "@playwright/test";

/**
 * The legacy `/search?type=…` list — the surviving `TypeSearch` surface, which
 * after the item 29 routing decision serves only `genome_sequence` and
 * `genome_amr`.
 */
export class LegacySearchPage {
  constructor(
    readonly page: Page,
    readonly resource: string,
    readonly idField: string,
  ) {}

  async goto(keyword: string) {
    await this.page.goto(
      `/search?type=${this.resource}&q=${encodeURIComponent(keyword)}`,
    );
  }

  rowCheckbox(id: string) {
    return this.page.getByRole("checkbox", { name: `Select row ${id}` });
  }

  async selectRow(id: string) {
    await this.rowCheckbox(id).check();
  }

  async expectRowVisible(id: string) {
    await expect(this.rowCheckbox(id)).toBeVisible();
  }

  async expectTotal(total: number) {
    await expect(
      this.page.getByText(new RegExp(`of ${String(total)} results`)),
    ).toBeVisible();
  }

  /** The left-hand type menu entry for this list's own type. */
  typeMenuEntry(label: string) {
    return this.page.getByRole("button", { name: label });
  }

  /**
   * An action-bar button by its accessible name. Actions that render a letter
   * badge include it, so GENOME's name is "G GENOME" — matched exactly so it
   * cannot also pick up the "Genomes" type-menu entry or a sort header.
   */
  action(name: string) {
    return this.page.getByRole("button", { name, exact: true });
  }

  async showFilters() {
    await this.page.getByRole("button", { name: "Show Filters" }).click();
  }

  facetChooserTrigger() {
    return this.page.getByRole("button", { name: "Facets" });
  }

  facetOption(label: string) {
    return this.page.getByRole("menuitemcheckbox", { name: label });
  }
}
