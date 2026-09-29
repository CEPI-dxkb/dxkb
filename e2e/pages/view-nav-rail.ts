import type { Locator, Page } from "@playwright/test";

/**
 * The collapsible left view rail (`landing-nav.tsx`) shared by organism landing
 * pages and entity views. The toggle's accessible name flips with its state.
 */
export class ViewNavRail {
  readonly collapseButton: Locator;
  readonly expandButton: Locator;

  constructor(page: Page) {
    this.collapseButton = page.getByRole("button", {
      name: "Collapse view navigation",
    });
    this.expandButton = page.getByRole("button", {
      name: "Expand view navigation",
    });
  }

  /**
   * Returns as soon as the click lands, without waiting for the rail to redraw:
   * the preference has to survive a navigation issued straight after the click.
   */
  async collapse(): Promise<void> {
    await this.collapseButton.click();
  }
}
