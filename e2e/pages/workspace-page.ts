import { expect, type Page, type Locator } from "@playwright/test";

import { awaitPanelLayoutCommitted } from "../a11y/settle";
import { ErrorAlert } from "./error-alert";
import { PanelSplit } from "./panel-split";

/**
 * Page object for `/workspace/*`; rows are found by role "row" and visible
 * text, which is stable across the virtual scroller.
 */
export class WorkspacePage {
  readonly page: Page;
  readonly breadcrumbs: Locator;
  readonly typeFilterTrigger: Locator;
  readonly searchInput: Locator;
  readonly refreshButton: Locator;
  readonly newFolderButton: Locator;
  readonly uploadButton: Locator;
  readonly showHiddenButton: Locator;
  readonly showDetailsButton: Locator;
  readonly panels: PanelSplit;
  readonly notFoundDialog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.notFoundDialog = page.getByRole("alertdialog", {
      name: "Folder not found",
    });
    this.breadcrumbs = page.getByRole("navigation", { name: /workspace path/i });
    this.typeFilterTrigger = page.getByRole("combobox").first();
    this.searchInput = page.getByPlaceholder(/search files/i);
    this.refreshButton = page.getByRole("button", { name: /^refresh$/i });
    this.newFolderButton = page.getByRole("button", { name: /^new folder$/i });
    this.uploadButton = page.getByRole("button", { name: /^upload$/i });
    this.showHiddenButton = page.getByRole("button", {
      name: /^(show|hide) hidden$/i,
    });
    // By title: the button's accessible name is just "Show".
    this.showDetailsButton = page.getByTitle("Show details panel");
    this.panels = new PanelSplit(page);
  }

  async goto(path?: string): Promise<void> {
    const target = path ?? "/workspace/e2e-test-user@patricbrc.org/home";
    await this.page.goto(target);
    await expect(this.breadcrumbs).toBeVisible();
  }

  /** `title` names where it failed: home root vs a deeper folder. */
  loadError(title: string): ErrorAlert {
    return new ErrorAlert(this.page, title);
  }

  rowByName(name: string): Locator {
    return this.page.getByRole("row").filter({
      has: this.page.getByRole("cell", { name, exact: true }),
    });
  }

  async selectFile(name: string): Promise<void> {
    await this.rowByName(name).click();
  }

  async enterFolder(name: string): Promise<void> {
    await this.rowByName(name).first().dblclick();
  }

  /**
   * Waits for the panel group to stop moving: it collapses the details panel
   * from a client effect, and a click in that window loses its `mouseup`
   * target so the dialog never opens.
   */
  private async awaitToolbarStable(): Promise<void> {
    await awaitPanelLayoutCommitted(this.page);
  }

  async showDetailsPanel(): Promise<void> {
    await this.awaitToolbarStable();
    await this.showDetailsButton.click();
    await this.panels.settle();
  }

  async openUpload(): Promise<void> {
    await this.awaitToolbarStable();
    await this.uploadButton.click();
    await expect(this.page.getByRole("dialog").getByText(/^upload$/i)).toBeVisible();
  }

  async openNewFolder(): Promise<void> {
    await this.awaitToolbarStable();
    await this.newFolderButton.click();
    // Target the heading: "Create Folder" is also the confirm button.
    await expect(
      this.page.getByRole("dialog").getByRole("heading", { name: /^create folder$/i }),
    ).toBeVisible();
  }

  async dataRowCount(): Promise<number> {
    const rows = this.page.locator("tbody tr");
    return rows.count();
  }
}
