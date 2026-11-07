import { expect, type Page } from "@playwright/test";

export class TaxonInteractionsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
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
   * The graph lays out in a Web Worker after its rows load, behind a "Laying
   * out…" status over the canvas. Wait for it to clear before measuring or
   * clicking the canvas.
   */
  async waitForLayout(): Promise<void> {
    await expect(
      this.page.getByRole("tabpanel", { name: "Graph" }).getByRole("status").filter({ hasText: "Laying out…" }),
    ).toHaveCount(0, { timeout: 15_000 });
  }

  /** The layout reported no failure (its Alert would sit over the canvas). */
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

  /** Table subview's own FilterBar keyword box (top of the Table tabpanel). */
  async filterByKeyword(text: string): Promise<void> {
    await this.page
      .getByRole("tabpanel", { name: "Table" })
      .getByPlaceholder("Search interaction results...")
      .fill(text);
  }

  /** Graph subview's keyword box, rendered in its own GraphToolbar. */
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

  /** The Graph action bar's layout Select trigger. */
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

  /** A protein row in the Graph subview's node list, by its visible label. */
  async selectNodeInList(label: string): Promise<void> {
    await this.page.getByRole("tabpanel", { name: "Graph" }).getByRole("option", { name: label }).click();
  }

  private detailPanel() {
    return this.page.getByRole("tabpanel", { name: "Graph" }).getByLabel("Selection details");
  }

  async expectDetailText(text: string): Promise<void> {
    await expect(this.detailPanel().getByText(text, { exact: false }).first()).toBeVisible();
  }

  /** Click the first incident-edge button listed in the node's detail panel. */
  async selectFirstIncidentEdge(): Promise<void> {
    await this.detailPanel().getByRole("button").first().click();
  }
}
