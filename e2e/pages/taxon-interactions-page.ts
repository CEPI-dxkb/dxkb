import { expect, type Locator, type Page } from "@playwright/test";
import { CollectionToolbar } from "./collection-toolbar";

/** The Graph draws at most this many interactions (`interactionsGraphRowLimit`). */
const graphRowLimit = "5,000";

export class TaxonInteractionsPage {
  readonly page: Page;
  /**
   * The Filters toolbar of whichever subview is showing: the Table's is hidden while the Graph is
   * up (and the reverse), so the page-level locators resolve to one.
   */
  readonly toolbar: CollectionToolbar;

  constructor(page: Page) {
    this.page = page;
    this.toolbar = new CollectionToolbar(page);
  }

  async goto(taxonId: string): Promise<void> {
    await this.page.goto(`/taxonomy/${taxonId}?tab=interactions`);
    await expect(this.page).toHaveURL(/tab=interactions/);
  }

  async expectResultCount(text: string): Promise<void> {
    await expect(this.page.getByText(text)).toBeVisible({ timeout: 10_000 });
  }

  async expectInteractor(interactor: string): Promise<void> {
    await expect(this.page.getByText(interactor)).toBeVisible();
  }

  async expectTab(name: string): Promise<void> {
    await expect(this.page.getByRole("button", { name })).toBeVisible();
  }

  async switchToGraph(): Promise<void> {
    const tab = this.page.getByRole("tab", { name: "Graph" });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
  }

  async switchToTable(): Promise<void> {
    const tab = this.page.getByRole("tab", { name: "Table" });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
  }

  /**
   * The graph lays out in a Web Worker behind a "Laying out…" status; wait
   * for it to clear before measuring or clicking.
   */
  async waitForLayout(): Promise<void> {
    await expect(
      this.page.getByRole("tabpanel", { name: "Graph" }).getByRole("status").filter({ hasText: "Laying out…" }),
    ).toHaveCount(0, { timeout: 15_000 });
  }

  async expectNoLayoutError(): Promise<void> {
    await expect(
      this.page.getByRole("tabpanel", { name: "Graph" }).getByText("Could not lay out the graph"),
    ).toHaveCount(0);
  }

  async expectCanvasVisible(): Promise<void> {
    await expect(this.page.getByRole("tabpanel", { name: "Graph" }).locator("canvas").first()).toBeVisible();
  }

  async expectEmptyGraphWorkspace(): Promise<void> {
    const graphPanel = this.page.getByRole("tabpanel", { name: "Graph" });
    await expect(graphPanel.getByText("No Interactions", { exact: true })).toBeVisible();
    await expect(graphPanel.getByRole("combobox", { name: "Layout" })).toBeVisible();
    await expect(graphPanel.getByRole("button", { name: "Export" })).toBeDisabled();
    await expect(graphPanel.getByLabel("Selection details")).toBeVisible();
  }

  async filterByKeyword(text: string): Promise<void> {
    await this.page
      .getByRole("tabpanel", { name: "Table" })
      .getByPlaceholder("Search interaction results...")
      .fill(text);
  }

  async filterGraphByKeyword(text: string): Promise<void> {
    await this.page
      .getByRole("tabpanel", { name: "Graph" })
      .getByPlaceholder("Search interaction results...")
      .fill(text);
  }

  async expectTableKeywordValue(text: string): Promise<void> {
    await expect(
      this.page.getByRole("tabpanel", { name: "Table" }).getByPlaceholder("Search interaction results..."),
    ).toHaveValue(text);
  }

  async expectGraphKeywordValue(text: string): Promise<void> {
    await expect(
      this.page.getByRole("tabpanel", { name: "Graph" }).getByPlaceholder("Search interaction results..."),
    ).toHaveValue(text);
  }

  private layoutTrigger() {
    return this.page.getByRole("tabpanel", { name: "Graph" }).getByRole("combobox", { name: "Layout" });
  }

  async expectLayoutLabel(text: string): Promise<void> {
    await expect(this.layoutTrigger()).toContainText(text);
  }

  async selectLayout(label: string): Promise<void> {
    await this.layoutTrigger().click();
    await this.page.getByRole("option", { name: label }).click();
  }

  async selectNodeInList(label: string, exact = false): Promise<void> {
    await this.page
      .getByRole("tabpanel", { name: "Graph" })
      .getByRole("option", { name: label, exact })
      .click();
  }

  private detailPanel() {
    return this.page.getByRole("tabpanel", { name: "Graph" }).getByLabel("Selection details");
  }

  async expectDetailText(text: string): Promise<void> {
    await expect(this.detailPanel().getByText(text, { exact: false }).first()).toBeVisible();
  }

  async selectFirstIncidentEdge(): Promise<void> {
    // The incident edges are the panel's only list; the panel's first button is "Focus on this
    // protein".
    await this.detailPanel().getByRole("list").getByRole("button").first().click();
  }

  private graphPanel(): Locator {
    return this.page.getByRole("tabpanel", { name: "Graph" });
  }

  /**
   * The Graph's "first 5,000" banner, found by its title: Next's route announcer is an alert too.
   */
  private truncatedBanner(): Locator {
    return this.graphPanel()
      .getByRole("alert")
      .filter({ hasText: "Showing the first" });
  }

  /**
   * The banner for a result past the row limit: the title names `total`, and the text sends the
   * user to each control that narrows it, as that control is labelled.
   */
  async expectTruncatedBanner(total: number): Promise<void> {
    const banner = this.truncatedBanner();
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText(
      `Showing the first ${graphRowLimit} of ${total.toLocaleString("en-US")} interactions`,
    );
    for (const text of [
      "Filters menu",
      "Focus on this protein",
      "Show in Graph",
      "Table subview",
    ]) {
      await expect(banner).toContainText(text);
    }
  }

  /** Picks `value` under the facet `field` ("Interaction Type") and closes the menu. */
  async pickFilter(field: string, value: string): Promise<void> {
    await this.toolbar.pickFacetValue(field, value);
    await this.toolbar.closeFilters();
  }

  /** The shared filters live in the Table's `interactions.*` params, which both subviews read. */
  async expectUrlFilter(field: string, value: string): Promise<void> {
    await expect
      .poll(() =>
        new URL(this.page.url()).searchParams.get(`interactions.${field}`),
      )
      .toBe(value);
  }

  /** "Focus on this protein" for the node selected in the Graph's detail panel. */
  async focusSelectedNode(): Promise<void> {
    await this.detailPanel()
      .getByRole("button", { name: "Focus on this protein" })
      .click();
  }

  /**
   * `label`'s filter is active in the toolbar of the subview that is showing: its pill, or, when
   * the toolbar is too narrow for every pill (the evidence default, a pick and a focus), the
   * "+N more filters: <labels>" button that names it.
   */
  async expectFilterActive(label: string): Promise<void> {
    const folded = this.toolbar
      .root()
      .getByRole("button", {
        name: new RegExp(
          `^\\d+ more filters: (?:.*, )?${label}(?:, .*)?\\. Open in the Filters menu$`,
        ),
      });
    await expect(this.toolbar.activeFilterPill(label).or(folded)).toBeVisible();
  }

  private tablePanel(): Locator {
    return this.page.getByRole("tabpanel", { name: "Table" });
  }

  async selectTableRows(...ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.tablePanel()
        .getByRole("checkbox", { name: `Select row ${id}` })
        .check();
    }
  }

  /** The Table's selection-bar tile; its label is the two lines "SHOW IN" and "GRAPH". */
  async showSelectedRowsInGraph(): Promise<void> {
    await this.tablePanel()
      .getByRole("button", { name: /^SHOW IN\s+GRAPH$/ })
      .click();
    await expect(
      this.page.getByRole("tab", { name: "Graph" }),
    ).toHaveAttribute("aria-selected", "true");
  }

  async expectSelectionChip(count: number): Promise<void> {
    const noun = count === 1 ? "interaction" : "interactions";
    const graphPanel = this.graphPanel();
    await expect(
      graphPanel.getByText(`Showing ${String(count)} selected ${noun}`, {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      graphPanel.getByRole("button", { name: "Show all", exact: true }),
    ).toBeVisible();
  }

  async showAll(): Promise<void> {
    await this.graphPanel()
      .getByRole("button", { name: "Show all", exact: true })
      .click();
  }

  /** The keyword box and Filters menu, which a Table selection in the Graph replaces. */
  async expectGraphFilterBar(shown: boolean): Promise<void> {
    const count = shown ? 1 : 0;
    await expect(
      this.graphPanel().getByPlaceholder("Search interaction results..."),
    ).toHaveCount(count);
    await expect(this.toolbar.filtersButton()).toHaveCount(count);
  }

  async expectGraphNode(label: string, shown: boolean): Promise<void> {
    await expect(
      this.graphPanel().getByRole("option", { name: label, exact: true }),
    ).toHaveCount(shown ? 1 : 0);
  }
}
