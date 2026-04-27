import { expect, type Page, type Locator } from "@playwright/test";

/**
 * Page object for bioinformatics service forms (e.g. `/services/genome-assembly`).
 * The form layout is shared across services — input cards, parameters, output folder/name,
 * and a primary submit button — so this helper covers the common interactions.
 */
export class ServiceFormPage {
  readonly page: Page;
  readonly heading: Locator;

  constructor(page: Page, headingText: string | RegExp) {
    this.page = page;
    this.heading = page.getByRole("heading", { level: 1, name: headingText });
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path);
    await expect(this.heading).toBeVisible();
  }

  /**
   * Type a path into a WorkspaceObjectSelector input by its placeholder, then press Enter to
   * commit the selection. This bypasses the dropdown, since object-selector options only appear
   * when the search matches a loaded object, and typing the full path already gives the form
   * everything it needs.
   */
  async fillObjectSelector(placeholder: RegExp, value: string): Promise<void> {
    const input = this.page.getByPlaceholder(placeholder).first();
    await input.click();
    await input.fill(value);
  }

  /** Set the output folder via the workspace object selector labelled "Select Output Folder..." */
  async setOutputFolder(path: string): Promise<void> {
    await this.fillObjectSelector(/select output folder/i, path);
  }

  /** Set the output name field (text input, not a selector). */
  async setOutputName(name: string): Promise<void> {
    const input = this.page.getByPlaceholder(/select output name/i);
    await input.fill(name);
  }

  /** Click the primary submit button by its visible label. */
  async submit(submitLabel: string | RegExp): Promise<void> {
    await this.page.getByRole("button", { name: submitLabel }).click();
  }
}
