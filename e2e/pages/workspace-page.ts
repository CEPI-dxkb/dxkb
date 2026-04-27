import { expect, type Page, type Locator } from "@playwright/test";

/**
 * Page object for `/workspace/*` routes. Encapsulates the selectors the browser exposes for
 * breadcrumbs, toolbar actions, rows, and the details panel so specs can express intent rather
 * than plumbing. Row lookup uses the data-table role "row" filtered by visible text — this is
 * stable across the virtual scroller because TanStack Table always renders the current window.
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

  constructor(page: Page) {
    this.page = page;
    this.breadcrumbs = page.getByRole("navigation", { name: /workspace path/i });
    this.typeFilterTrigger = page.getByRole("combobox").first();
    this.searchInput = page.getByPlaceholder(/search files/i);
    this.refreshButton = page.getByRole("button", { name: /^refresh$/i });
    this.newFolderButton = page.getByRole("button", { name: /^new folder$/i });
    this.uploadButton = page.getByRole("button", { name: /^upload$/i });
    this.showHiddenButton = page.getByRole("button", {
      name: /^(show|hide) hidden$/i,
    });
  }

  /** Navigate to a workspace path, defaulting to the signed-in user's home. */
  async goto(path?: string): Promise<void> {
    const target = path ?? "/workspace/e2e-test-user@patricbrc.org/home";
    await this.page.goto(target);
    await expect(this.breadcrumbs).toBeVisible();
  }

  rowByName(name: string): Locator {
    return this.page.getByRole("row").filter({
      has: this.page.getByRole("cell", { name, exact: true }),
    });
  }

  /** Selection-mode single-click: opens details panel without navigating. */
  async selectFile(name: string): Promise<void> {
    await this.rowByName(name).click();
  }

  /**
   * Enter a folder by selecting it and pressing Enter. Keyboard Enter goes through
   * `useTableKeyboardNavigation.onEnter`, which is a single-path navigation.
   * More reliable than `dblclick()` against a virtualized row: mouse double-click fires two
   * rapid events that can race with selection-mode rerenders and sometimes land on a different
   * node for the second click.
   */
  async enterFolder(name: string): Promise<void> {
    await this.rowByName(name).first().click();
    await this.page.keyboard.press("Enter");
  }

  async openUpload(): Promise<void> {
    await this.uploadButton.click();
    await expect(this.page.getByRole("dialog").getByText(/^upload$/i)).toBeVisible();
  }

  async openNewFolder(): Promise<void> {
    await this.newFolderButton.click();
  }

  /** Count the data rows currently rendered (excludes special "parent" row). */
  async dataRowCount(): Promise<number> {
    // Data rows always contain at least a cell with the name column; filter out header rows.
    const rows = this.page.locator("tbody tr");
    return rows.count();
  }
}
