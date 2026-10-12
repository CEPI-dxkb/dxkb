import { expect, type Locator, type Page } from "@playwright/test";
import { ServiceFormPage } from "./service-form-page";

/**
 * The Input card's three selectors: each is a labelled workspace object
 * selector with an icon-only Add button beside it.
 */
const viralGenomeTreeInputs = {
  genomeGroup: { label: "Genome Group", addButton: "Add genome group" },
  alignedFasta: { label: "Aligned FASTA", addButton: "Add aligned sequence" },
  unalignedFasta: {
    label: "Unaligned FASTA",
    addButton: "Add unaligned sequence",
  },
} as const;

export type ViralGenomeTreeInput = keyof typeof viralGenomeTreeInputs;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Page object for `/services/viral-genome-tree`'s Input card: pick a
 * workspace object in one of the labelled selectors, press its Add button,
 * and read the outcome, either a sonner toast or a row in the selected
 * sequences table.
 *
 * The selector labels are not tied to their inputs (every input is a combobox
 * named "Optional"), so a selector is found through its label's wrapper.
 */
export class ViralGenomeTreePage {
  readonly page: Page;
  readonly form: ServiceFormPage;
  readonly selectedRows: Locator;
  readonly emptySelection: Locator;
  readonly toasts: Locator;

  constructor(page: Page) {
    this.page = page;
    this.form = new ServiceFormPage(page, /viral genome tree/i);
    this.selectedRows = page.getByRole("row").filter({
      has: page.getByRole("button", { name: "Remove selected sequence" }),
    });
    // The empty row has a cell for each layout; one is hidden.
    this.emptySelection = page
      .getByText("No items selected.", { exact: true })
      .filter({ visible: true });
    this.toasts = page.locator("[data-sonner-toast]");
  }

  /**
   * Open the form and wait until its selectors have hydrated. The heading is
   * server-rendered, so it shows before React attaches the inputs' handlers,
   * and a search typed in that window is lost: the input shows the text, but
   * React never saw it, so no suggestions open (seen in CI's WebKit, which
   * filled 180ms after the heading showed). React attaches a hydrated
   * element's props as `__reactProps$<id>`.
   */
  async goto(): Promise<void> {
    await this.form.goto("/services/viral-genome-tree");
    const selectors = Object.keys(viralGenomeTreeInputs).map((input) =>
      this.selector(input as ViralGenomeTreeInput),
    );
    for (const selector of selectors) {
      await expect
        .poll(
          () =>
            selector.evaluate((input) =>
              Object.entries(input).some(
                ([key, props]) =>
                  key.startsWith("__reactProps$") &&
                  typeof (props as { onChange?: unknown }).onChange ===
                    "function",
              ),
            ),
          { message: "the Input card's selectors did not hydrate" },
        )
        .toBe(true);
    }
  }

  /** The label and the row holding its selector and Add button. */
  private field(input: ViralGenomeTreeInput): Locator {
    return this.page
      .locator("label")
      .filter({
        hasText: new RegExp(
          `^${escapeRegExp(viralGenomeTreeInputs[input].label)}$`,
        ),
      })
      .filter({ visible: true })
      .locator("xpath=..");
  }

  selector(input: ViralGenomeTreeInput): Locator {
    return this.field(input).getByRole("combobox");
  }

  addButton(input: ViralGenomeTreeInput): Locator {
    return this.field(input).getByRole("button", {
      name: viralGenomeTreeInputs[input].addButton,
      exact: true,
    });
  }

  /** Search the selector for `name` and choose the matching object. */
  async pick(input: ViralGenomeTreeInput, name: string): Promise<void> {
    const selector = this.selector(input);
    await selector.fill(name);
    await this.page
      .getByRole("listbox")
      .getByRole("option", { name: new RegExp(`^${escapeRegExp(name)}`) })
      .click();
    await expect(selector).toHaveValue(name);
  }

  /** Pick `name` in the selector, then press its Add button. */
  async add(input: ViralGenomeTreeInput, name: string): Promise<void> {
    await this.pick(input, name);
    await this.addButton(input).click();
  }

  /** The Add button is enabled and shows its plus icon, not the spinner. */
  async expectAddReady(input: ViralGenomeTreeInput): Promise<void> {
    const button = this.addButton(input);
    await expect(button).toBeEnabled();
    await expect(button.getByRole("status", { name: "Loading" })).toHaveCount(
      0,
    );
  }

  /** The visible toast whose title is exactly `title`. */
  toast(title: string): Locator {
    return this.toasts.filter({
      has: this.page.locator("[data-title]").filter({
        hasText: new RegExp(`^${escapeRegExp(title)}$`),
      }),
    });
  }

  /**
   * A toast's description as rendered: `innerText` keeps a "\n" only where
   * the description's `white-space` keeps it, so this reads the line breaks
   * a user sees.
   */
  async toastDescription(title: string): Promise<string> {
    const toast = this.toast(title);
    await expect(toast).toBeVisible();
    return toast.locator("[data-description]").innerText();
  }

  /** The selected-sequences row for the object at `path`. */
  selectedRow(path: string): Locator {
    return this.selectedRows.filter({ hasText: path });
  }
}
