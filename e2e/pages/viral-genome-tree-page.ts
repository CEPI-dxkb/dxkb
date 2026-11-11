import { expect, type Locator, type Page } from "@playwright/test";
import { expectHydrated } from "./hydration";
import { ServiceFormPage } from "./service-form-page";

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
 * Page object for the Input card. The selector labels are not tied to their
 * inputs (every input is a combobox named "Optional"), so a selector is found
 * through its label's wrapper.
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
   * Waits for the selectors to hydrate: the heading is server-rendered
   * earlier, and a search typed before React attaches handlers is lost (seen
   * in CI WebKit). A hydrated element carries `__reactProps$<id>`.
   */
  async goto(): Promise<void> {
    await this.form.goto("/services/viral-genome-tree");
    const selectors = Object.keys(viralGenomeTreeInputs).map((input) =>
      this.selector(input as ViralGenomeTreeInput),
    );
    for (const selector of selectors) {
      await expectHydrated(
        selector,
        "onChange",
        "the Input card's selectors did not hydrate",
      );
    }
  }

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

  async pick(input: ViralGenomeTreeInput, name: string): Promise<void> {
    const selector = this.selector(input);
    await selector.fill(name);
    await this.page
      .getByRole("listbox")
      .getByRole("option", { name: new RegExp(`^${escapeRegExp(name)}`) })
      .click();
    await expect(selector).toHaveValue(name);
  }

  async add(input: ViralGenomeTreeInput, name: string): Promise<void> {
    await this.pick(input, name);
    await this.addButton(input).click();
  }

  async expectAddReady(input: ViralGenomeTreeInput): Promise<void> {
    const button = this.addButton(input);
    await expect(button).toBeEnabled();
    await expect(button.getByRole("status", { name: "Loading" })).toHaveCount(
      0,
    );
  }

  toast(title: string): Locator {
    return this.toasts.filter({
      has: this.page.locator("[data-title]").filter({
        hasText: new RegExp(`^${escapeRegExp(title)}$`),
      }),
    });
  }

  /**
   * `innerText` keeps a newline only where the description's `white-space`
   * does, so this reads the breaks a user sees.
   */
  async toastDescription(title: string): Promise<string> {
    const toast = this.toast(title);
    await expect(toast).toBeVisible();
    return toast.locator("[data-description]").innerText();
  }

  selectedRow(path: string): Locator {
    return this.selectedRows.filter({ hasText: path });
  }
}
