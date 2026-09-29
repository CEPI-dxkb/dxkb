import { expect, type Locator, type Page } from "@playwright/test";

import { ViewNavRail } from "./view-nav-rail";

export class OrganismLandingPage {
  readonly page: Page;
  readonly viewNav: ViewNavRail;
  /** Links into taxon pages (the genus cards), which Next prefetches. */
  readonly taxonomyLinks: Locator;

  constructor(page: Page) {
    this.page = page;
    this.viewNav = new ViewNavRail(page);
    this.taxonomyLinks = page.locator('a[href^="/taxonomy/"]');
  }

  async goto(slug: string): Promise<void> {
    await this.page.goto(`/organisms/${slug}`);
    await expect(this.page.getByRole("heading", { level: 1 })).toBeVisible();
  }

  // Visible cards only. The KPI cards stream in through a Suspense boundary,
  // and React can render them in place while its hidden staged copy of the
  // same markup (`<div hidden id="S:n">` at the end of <body>) is still waiting
  // for the queued reveal script to remove it. CSS and test-id locators match
  // hidden elements (role locators don't), so without the filter this resolves
  // to two cards and fails strict mode.
  getKpi(label: string): Locator {
    return this.page
      .locator('[data-testid^="organism-kpi-"]')
      .filter({ hasText: label, visible: true });
  }

  getGenusCard(name: string): Locator {
    return this.page.getByRole("link", { name: `View ${name} genomes` });
  }

  expectDonut(title: string): Promise<void> {
    return expect(this.page.getByRole("img", { name: `${title} distribution` })).toBeVisible();
  }
}
