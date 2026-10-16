import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The collapsible left view rail (`landing-nav.tsx`) shared by organism landing
 * pages and entity views. The toggle's accessible name flips with its state.
 */
export class ViewNavRail {
  readonly collapseButton: Locator;
  readonly expandButton: Locator;
  private readonly buttons: Locator;

  constructor(page: Page) {
    this.collapseButton = page.getByRole("button", {
      name: "Collapse view navigation",
    });
    this.expandButton = page.getByRole("button", {
      name: "Expand view navigation",
    });
    this.buttons = page
      .getByRole("navigation")
      .filter({ has: this.collapseButton.or(this.expandButton) })
      .getByRole("button");
  }

  /**
   * The rail has hydrated, so the page's router is live and a click on a tab will be handled.
   * For a server-rendered view (the overview) with no client-loaded content to wait on. React
   * attaches a hydrated element's props as `__reactProps$<id>`, so this waits for every rail
   * button's `onClick` to be there.
   */
  async waitForHydration(): Promise<void> {
    await expect
      .poll(
        () =>
          this.buttons.evaluateAll(
            (buttons) =>
              buttons.length > 0 &&
              buttons.every((button) =>
                Object.entries(button).some(
                  ([key, props]) =>
                    key.startsWith("__reactProps$") &&
                    typeof (props as { onClick?: unknown }).onClick ===
                      "function",
                ),
              ),
          ),
        { message: "the view rail's buttons did not hydrate" },
      )
      .toBe(true);
  }

  /**
   * Returns as soon as the click lands, without waiting for the rail to redraw:
   * the preference has to survive a navigation issued straight after the click.
   */
  async collapse(): Promise<void> {
    await this.collapseButton.click();
  }
}
