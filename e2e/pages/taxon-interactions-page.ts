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

  async selectNodeInList(label: string): Promise<void> {
    await this.page.getByRole("tabpanel", { name: "Graph" }).getByRole("option", { name: label }).click();
  }

  private detailPanel() {
    return this.page.getByRole("tabpanel", { name: "Graph" }).getByLabel("Selection details");
  }

  async expectDetailText(text: string): Promise<void> {
    await expect(this.detailPanel().getByText(text, { exact: false }).first()).toBeVisible();
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

  /** The node is highlighted in the node list and its BRC ID fills the details pane. */
  async expectNodeSelected(label: string): Promise<void> {
    await expect(
      this.page.getByRole("tabpanel", { name: "Graph" }).getByRole("option", { name: label }),
    ).toHaveAttribute("data-app-selected", "true");
    await expect(this.detailPanel().getByText("BRC ID")).toBeVisible();
    await expect(this.detailPanel().getByRole("link", { name: label, exact: true })).toBeVisible();
  }

  async selectFirstIncidentEdge(): Promise<void> {
    await this.detailPanel().getByRole("button").first().click();
  }
}
