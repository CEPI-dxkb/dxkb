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
    await expect(graphPanel.getByLabel("Selection details", { exact: true })).toBeVisible();
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

  /**
   * A protein's row in the list, found by searching for it: the list draws only its top-ranked rows
   * (a Graph can hold thousands of proteins), and its search reaches every protein.
   */
  private async listRow(label: string, exact: boolean): Promise<Locator> {
    const graphPanel = this.page.getByRole("tabpanel", { name: "Graph" });
    await graphPanel.getByPlaceholder("Search proteins…").fill(label);
    return graphPanel.getByRole("option", { name: label, exact });
  }

  async selectNodeInList(label: string, exact = false): Promise<void> {
    await (await this.listRow(label, exact)).click();
  }

  async addNodeToSelectionInList(label: string): Promise<void> {
    await (await this.listRow(label, false)).click({
      modifiers: ["ControlOrMeta"],
    });
  }

  private detailPanel() {
    return this.page.getByRole("tabpanel", { name: "Graph" }).getByLabel("Selection details", { exact: true });
  }

  async expectDetailText(text: string): Promise<void> {
    await expect(this.detailPanel().getByText(text, { exact: false }).first()).toBeVisible();
  }

  /**
   * Opens the details pane's "Identifiers" row. A selected protein starts with it closed, so its
   * genome, locus tag and BRC ID (and their links) can only be read once it is open.
   */
  async openIdentifiers(): Promise<void> {
    const identifiers = this.detailPanel().locator("details").first();
    if ((await identifiers.getAttribute("open")) === null) {
      await identifiers.getByText("Identifiers", { exact: true }).click();
    }
    await expect(identifiers).toHaveAttribute("open", "");
  }

  /** A link in the Graph sub-tab's "Selection details" pane, named `name`, that points at `href`. */
  async expectDetailLink(name: string | RegExp, href: string): Promise<void> {
    await expect(this.detailPanel().getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
  }

  private zoomPercentInput() {
    return this.page.getByRole("tabpanel", { name: "Graph" }).getByRole("spinbutton", { name: "Zoom percentage" });
  }

  /** Zooms in with the canvas's zoom control and waits for the camera to land in the URL. */
  async zoomIn(): Promise<string> {
    const input = this.zoomPercentInput();
    const before = await input.inputValue();
    await this.page.getByRole("tabpanel", { name: "Graph" }).getByRole("button", { name: "Zoom in" }).click();
    await expect(input).not.toHaveValue(before);
    // The camera is written once it rests (debounced).
    await expect(this.page).toHaveURL(/interactionsGraph\.cam=/);
    return input.inputValue();
  }

  async expectZoomPercent(value: string): Promise<void> {
    await expect(this.zoomPercentInput()).toHaveValue(value);
  }

  /** Follows a details-pane link in this tab and waits for the destination's URL. */
  async followDetailLink(name: string, href: string): Promise<void> {
    await this.openIdentifiers();
    await this.detailPanel().getByRole("link", { name, exact: true }).click();
    await expect(this.page).toHaveURL((url) => url.pathname === href);
  }

  /** Browser Back to the Interactions tab. */
  async goBack(): Promise<void> {
    await this.page.goBack();
    await expect(this.page).toHaveURL(/tab=interactions/);
  }

  async expectGraphActive(): Promise<void> {
    await expect(this.page.getByRole("tab", { name: "Graph" })).toHaveAttribute("aria-selected", "true");
  }

  /** The node is highlighted in the node list and the details pane is headed by its name. */
  async expectNodeSelected(label: string): Promise<void> {
    await expect(
      this.page.getByRole("tabpanel", { name: "Graph" }).getByRole("option", { name: label }),
    ).toHaveAttribute("data-app-selected", "true");
    await expect(this.detailPanel().getByRole("heading", { level: 2, name: label })).toBeVisible();
  }

  async selectFirstIncidentEdge(): Promise<void> {
    // The partners are the panel's only list; its first button opens the interaction with the
    // first partner (the panel's own first button is "Focus on this protein").
    await this.detailPanel().getByRole("list").getByRole("button").first().click();
  }

  private graphPanel(): Locator {
    return this.page.getByRole("tabpanel", { name: "Graph" });
  }

  /**
   * The Graph's "first 5,000" notice: a polite status over the canvas's top-left, found by its
   * title because the "Laying out…" veil is a status too.
   */
  private truncationNotice(): Locator {
    return this.graphPanel()
      .getByRole("status")
      .filter({ hasText: /^Showing the first/ });
  }

  /**
   * The notice for a result past the row limit: its title names `total`. Without a `total` it only
   * checks that the notice names the limit (the count read can lag the rows).
   */
  async expectTruncationNotice(total?: number): Promise<void> {
    const notice = this.truncationNotice();
    await expect(notice).toBeVisible({ timeout: 15_000 });
    await expect(notice).toContainText(
      total === undefined
        ? `Showing the first ${graphRowLimit}`
        : `Showing the first ${graphRowLimit} of ${total.toLocaleString("en-US")} interactions`,
    );
  }

  /**
   * Opens the notice's "Why?" popover, checks its one-sentence reason, and closes it again so it
   * does not sit over the canvas for the picks that follow.
   */
  async expectTruncationReason(): Promise<void> {
    await this.truncationNotice().getByRole("button", { name: /Why/ }).click();
    const reason = this.page.getByRole("dialog", { name: /^Showing the first/ });
    await expect(reason).toContainText(
      "The graph can't draw them all. Narrow with search or Filters, or use the Table to see every interaction.",
    );
    await this.page.keyboard.press("Escape");
    await expect(reason).toBeHidden();
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
   * the toolbar is too narrow for every pill (a facet pick and a focus), the
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
