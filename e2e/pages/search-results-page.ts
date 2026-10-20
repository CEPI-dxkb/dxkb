import type { Page } from "@playwright/test";

import { encodeQueryComponent } from "@/lib/url";
import { ErrorAlert } from "./error-alert";

/** The all-data-types search results (`/search?q=…`). */
export class SearchResultsPage {
  readonly page: Page;
  /** The search failed; its message says why, and Retry runs it again. */
  readonly loadError: ErrorAlert;

  constructor(page: Page) {
    this.page = page;
    this.loadError = new ErrorAlert(page, "Search results could not be loaded");
  }

  async goto(keyword: string): Promise<void> {
    await this.page.goto(`/search?q=${encodeQueryComponent(keyword)}`);
  }
}
