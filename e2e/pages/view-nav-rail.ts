import { type Locator, type Page } from "@playwright/test";
import { expectHydrated } from "./hydration";

/**
 * The collapsible left view rail (`landing-nav.tsx`); the toggle's accessible
 * name flips with its state.
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
   * For server-rendered views with no client-loaded content to wait on: waits
   * for every rail button's `onClick` (`__reactProps$<id>`).
   */
  async waitForHydration(): Promise<void> {
    await expectHydrated(
      this.buttons,
      "onClick",
      "the view rail's buttons did not hydrate",
    );
  }

  /**
   * Returns as soon as the click lands, so the preference must survive a
   * navigation issued straight after.
   */
  async collapse(): Promise<void> {
    await this.collapseButton.click();
  }
}
