import type { Locator, Page } from "@playwright/test";

/**
 * A destructive error Alert (`role="alert"`) found by its title: the record
 * pages' `ErrorPanel`, the workspace and jobs load errors, the search error.
 * Filtered by title because Next's route announcer is an alert too.
 */
export class ErrorAlert {
  readonly root: Locator;
  /** "Retry", or "Retrying…" while a retry is in flight. */
  readonly retryButton: Locator;

  constructor(page: Page, title: string | RegExp) {
    this.root = page.getByRole("alert").filter({ hasText: title });
    this.retryButton = this.root.getByRole("button", { name: /^retry/i });
  }
}
