import { expect, type Locator, type Page } from "@playwright/test";

import { ViewNavRail } from "./view-nav-rail";

export class OrganismLandingPage {
  readonly page: Page;
  readonly viewNav: ViewNavRail;
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

  // Visible only: React's hidden staged copy (`div[hidden]#S:n`) of streamed
  // cards matches CSS and test-id locators and trips strict mode.
  getKpi(label: string): Locator {
    return this.page
      .locator('[data-testid^="organism-kpi-"]')
      .filter({ hasText: label, visible: true });
  }

  getGenusCard(name: string): Locator {
    return this.page.getByRole("link", { name: `View ${name} genomes` });
  }

  // A donut with linked slices is a group (an img's children are
  // presentational); one without links is an img.
  expectDonut(title: string): Promise<void> {
    const name = `${title} distribution`;
    return expect(
      this.page
        .getByRole("group", { name })
        .or(this.page.getByRole("img", { name })),
    ).toBeVisible();
  }
}
