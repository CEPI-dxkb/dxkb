import { expect, type Locator, type Page } from "@playwright/test";

import { expectUrlParams } from "../support/url-params";
import { ErrorAlert } from "./error-alert";
import { ViewNavRail } from "./view-nav-rail";

/**
 * A genome member page (`/genome/<id>`); a data tab's table keeps its page
 * and sort under the tab's `<urlKey>.` prefix.
 */
export class GenomeMemberPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly viewNav: ViewNavRail;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { level: 1 });
    this.viewNav = new ViewNavRail(page);
  }

  /**
   * Opening a data tab by URL lets its client-fetched rows prove hydration
   * before any tab click, which would otherwise be lost.
   */
  async goto(genomeId: string, tab?: string): Promise<void> {
    await this.page.goto(
      tab ? `/genome/${genomeId}?tab=${tab}` : `/genome/${genomeId}`,
    );
    await expect(this.heading).toBeVisible();
  }

  /**
   * For tabs with no client-loaded table to wait on. The navbar is no proxy:
   * it sits outside the page's Suspense boundary and can hydrate before the
   * rail.
   */
  async waitForHydration(): Promise<void> {
    await this.viewNav.waitForHydration();
  }

  unavailable(genomeId: string): ErrorAlert {
    return new ErrorAlert(this.page, `Genome ${genomeId} could not be loaded`);
  }

  async openTab(label: string): Promise<void> {
    await this.page.getByRole("button", { name: label, exact: true }).click();
  }

  /** Rows load client-side, so a row also proves the page has hydrated. */
  async expectRow(name: string | RegExp): Promise<void> {
    await expect(this.page.getByRole("row", { name })).toBeVisible();
  }

  /**
   * Heuristic wait. After a document-loading history step Next re-fetches the
   * RSC payload, and WebKit cancels the next step if taken while it is
   * pending; `networkidle` cannot see that fetch. If CI shows "Navigation
   * canceled by policy check", track `?_rsc=` requests as `trackPrefetches`
   * in `e2e/tests/organisms/view-rail.spec.ts` does.
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
   * The first click sorts a text column ascending but a numeric one
   * descending, so tests sort by a text column.
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

  async rowsReadSort(
    resource: string,
    action: () => Promise<void>,
  ): Promise<string | null> {
    const read = this.page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === `/api/data/${resource}` &&
        url.searchParams.get("operation") === "collection" &&
        url.searchParams.has("field") &&
        !url.searchParams.has("facet")
      );
    });
    await action();
    return new URL((await read).url()).searchParams.get("sort");
  }

  /** Checked in a browser because jsdom computes no Tailwind styles. */
  async expectSortHighlight(
    sorted: string | null,
    other: string,
  ): Promise<void> {
    const look = (label: string) =>
      this.columnHeader(label).evaluate((header) => {
        const style = getComputedStyle(header);
        const chevron = header.querySelector(
          "svg.lucide-chevron-up, svg.lucide-chevron-down",
        );
        return {
          tint: style.backgroundColor,
          rule: style.boxShadow,
          chevron: chevron ? getComputedStyle(chevron).color : null,
        };
      });
    const plain = await look(other);
    expect(plain.rule).toBe("none");
    expect(plain.chevron).toBeNull();
    if (!sorted) return;
    await expect.poll(async () => (await look(sorted)).rule).toContain("inset");
    const highlighted = await look(sorted);
    expect(highlighted.tint).not.toBe(plain.tint);
    expect(highlighted.chevron).not.toBeNull();
    expect(highlighted.rule).toContain(highlighted.chevron ?? "a chevron");
  }

  async expectUrlParams(
    expected: Record<string, string | null>,
  ): Promise<void> {
    await expectUrlParams(this.page, expected);
  }

  /**
   * A user action that adds more than one entry leaves an intermediate one
   * that Back would stop on.
   */
  async historyLength(): Promise<number> {
    return this.page.evaluate(() => window.history.length);
  }
}
