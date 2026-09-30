import { expect, type Locator, type Page } from "@playwright/test";

import { expectUrlParams } from "../support/url-params";

/**
 * A genome member page (`/genome/<id>`): the view rail's tabs and the nested table a data tab
 * shows (Features, Sequences, ...). The table's page and sort live in the address under the
 * tab's `<urlKey>.` prefix (`features.sort`, `features.page`).
 */
export class GenomeMemberPage {
  readonly page: Page;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { level: 1 });
  }

  /**
   * Open a genome member page, on `tab` if given. Opening a data tab by URL lets its table rows
   * (fetched client-side) prove the page has hydrated before any tab click: a click that lands
   * before hydration is lost, because the view rail switches tabs only from a click handler.
   */
  async goto(genomeId: string, tab?: string): Promise<void> {
    await this.page.goto(
      tab ? `/genome/${genomeId}?tab=${tab}` : `/genome/${genomeId}`,
    );
    await expect(this.heading).toBeVisible();
  }

  /** Switch tab from the view rail (a router navigation, so one history entry). */
  async openTab(label: string): Promise<void> {
    await this.page.getByRole("button", { name: label, exact: true }).click();
  }

  /**
   * A data row is on screen: the nested table has loaded, not just its skeleton. The rows are
   * fetched client-side, so this also means the page has hydrated and a click will be handled.
   */
  async expectRow(name: string | RegExp): Promise<void> {
    await expect(this.page.getByRole("row", { name })).toBeVisible();
  }

  /**
   * Give the page's own follow-up requests time to finish, as a heuristic. After a history step
   * that loads a document (a Back or Forward over entries from an earlier document), Next
   * re-fetches the page's RSC payload once it has hydrated, and WebKit cancels the next history
   * step ("Navigation canceled by policy check") if it is taken while that fetch is pending.
   * `networkidle` resolves after the first 500 ms with no network activity following the content
   * wait that precedes this call. It does not know about the fetch, so a request that starts
   * after that quiet spell is missed, and it resolves at once after a same-document step. If CI
   * shows "Navigation canceled by policy check", replace it with deterministic `?_rsc=` in-flight
   * tracking, as `trackPrefetches` in `e2e/tests/organisms/view-rail.spec.ts` does.
   */
  async settle(): Promise<void> {
    await this.page.waitForLoadState("networkidle");
  }

  private sortButton(label: string): Locator {
    return this.page.getByRole("button", {
      name: `Sort by ${label}`,
      exact: true,
    });
  }

  private columnHeader(label: string): Locator {
    return this.page
      .getByRole("columnheader")
      .filter({ has: this.sortButton(label) });
  }

  /**
   * Click a column's sort button; it also resets the page. The first click sorts a text column
   * ascending but a numeric one descending, so tests sort by a text column.
   */
  async sortBy(label: string): Promise<void> {
    await this.sortButton(label).click();
  }

  async expectSort(
    label: string,
    state: "ascending" | "descending" | "none",
  ): Promise<void> {
    await expect(this.columnHeader(label)).toHaveAttribute("aria-sort", state);
  }

  /** Polls the address for the given query params (`null` = absent). */
  async expectUrlParams(
    expected: Record<string, string | null>,
  ): Promise<void> {
    await expectUrlParams(this.page, expected);
  }

  /**
   * Entries in the session history. A user action that adds more than one has left an
   * intermediate entry that Back would stop on.
   */
  async historyLength(): Promise<number> {
    return this.page.evaluate(() => window.history.length);
  }
}
