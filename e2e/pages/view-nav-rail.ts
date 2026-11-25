import { type Locator, type Page } from "@playwright/test";
import { expectHydrated } from "./hydration";

/**
 * The collapsible left view rail (`landing-nav.tsx`); the toggle's accessible
 * name flips with its state.
 */
export class ViewNavRail {
  readonly collapseButton: Locator;
  readonly expandButton: Locator;
  /**
   * The open tooltip of a rail control. Base UI's popup has no
   * `role="tooltip"`, so the shared `TooltipContent` slot is the narrowest
   * locator; it is portaled out of the rail, hence page-wide.
   */
  readonly tooltip: Locator;
  private readonly rail: Locator;
  private readonly buttons: Locator;

  constructor(page: Page) {
    this.collapseButton = page.getByRole("button", {
      name: "Collapse view navigation",
    });
    this.expandButton = page.getByRole("button", {
      name: "Expand view navigation",
    });
    this.tooltip = page.locator('[data-slot="tooltip-content"]');
    this.rail = page
      .getByRole("navigation")
      .filter({ has: this.collapseButton.or(this.expandButton) });
    this.buttons = this.rail.getByRole("button");
  }

  /** The focusable wrapper of a disabled tab; its aria-label is "<tab>: <reason>". */
  disabledTab(label: string, reason: string): Locator {
    return this.rail.getByLabel(`${label}: ${reason}`, { exact: true });
  }

  /** A tab's button; a disabled tab's is `aria-disabled`, an enabled tab's is not. */
  tab(label: string): Locator {
    return this.rail.getByRole("button", { name: label, exact: true });
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
