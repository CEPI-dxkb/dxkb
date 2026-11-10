import type { Locator, Page } from "@playwright/test";

/**
 * A destructive error Alert found by title, because Next's route announcer is
 * an alert too.
 */
export class ErrorAlert {
  readonly root: Locator;
  readonly retryButton: Locator;

  constructor(page: Page, title: string | RegExp) {
    this.root = page.getByRole("alert").filter({ hasText: title });
    this.retryButton = this.root.getByRole("button", { name: /^retry/i });
  }
}
