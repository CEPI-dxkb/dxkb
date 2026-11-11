import type { Page } from "@playwright/test";

import { encodeQueryComponent } from "@/lib/url";
import { ErrorAlert } from "./error-alert";

export class SearchResultsPage {
  readonly page: Page;
  readonly loadError: ErrorAlert;

  constructor(page: Page) {
    this.page = page;
    this.loadError = new ErrorAlert(page, "Search results could not be loaded");
  }

  async goto(keyword: string): Promise<void> {
    await this.page.goto(`/search?q=${encodeQueryComponent(keyword)}`);
  }
}
