import { expect, type Locator, type Page } from "@playwright/test";

import { CollectionToolbar } from "./collection-toolbar";
import { ErrorAlert } from "./error-alert";
import { expectHydrated } from "./hydration";
import { ViewNavRail } from "./view-nav-rail";

export class TaxonPage {
  readonly page: Page;
  readonly viewNav: ViewNavRail;
  readonly toolbar: CollectionToolbar;
  readonly taxonomyLinks: Locator;

  constructor(page: Page) {
    this.page = page;
    this.viewNav = new ViewNavRail(page);
    this.toolbar = new CollectionToolbar(page);
    // The stat tiles' links are `prefetch={false}`: a prefetch-settle helper
    // waits for an `_rsc` request per link it is given, which they never send.
    this.taxonomyLinks = page.locator(
      'a[href^="/taxonomy/"]:not([data-slot="stat-tile-link"])',
    );
  }

  async goto(taxonId: string, tab?: string): Promise<void> {
    if (tab === undefined) {
      await this.page.goto(`/taxonomy/${taxonId}`);
      return;
    }
    await this.page.goto(`/taxonomy/${taxonId}?tab=${tab}`);
    await expect(this.page).toHaveURL(new RegExp(`tab=${tab}`));
  }

  unavailable(taxonId: string): ErrorAlert {
    return new ErrorAlert(this.page, `Taxon ${taxonId} could not be loaded`);
  }

  /** An overview stat tile that links to its tab (Genomes / Segments, CDS, PDB); an unlinked tile is not a link. */
  statTile(label: string): Locator {
    return this.page.getByRole("link", { name: label });
  }

  tabButton(name: string): Locator {
    return this.page.getByRole("button", { name });
  }

  /** The Metadata Distributions section's "Charts N/M" dropdown. Its name carries the count and ", customised" once a chart is hidden. */
  get chartsMenu(): Locator {
    return this.page.getByRole("button", { name: /^Charts \d+\/\d+ shown/ });
  }

  /**
   * A Metadata Distributions chart by title. A donut with linked slices is a
   * group (an img's children are presentational) and one without links is an
   * img, as `OrganismLandingPage.expectDonut` locates them. Role queries skip
   * React's hidden `S:n` staging copy.
   */
  metadataChart(title: string): Locator {
    const name = `${title} distribution`;
    const section = this.page.getByTestId("metadata-distributions");
    return section
      .getByRole("group", { name })
      .or(section.getByRole("img", { name }));
  }

  /** Sets one chart's checkbox in the Charts menu, then closes the menu. */
  async setChartShown(title: string, shown: boolean): Promise<void> {
    // A server-rendered button clicked before React attaches its handler loses the click.
    await expectHydrated(this.chartsMenu, "onClick", "charts menu hydrated");
    await this.chartsMenu.click();
    const item = this.page.getByRole("menuitemcheckbox", {
      name: title,
      exact: true,
    });
    await expect(item).toBeVisible();
    if ((await item.getAttribute("aria-checked")) !== String(shown)) {
      await item.click();
    }
    await this.page.keyboard.press("Escape");
    await expect(item).toBeHidden();
  }

  /** Opens the Charts menu and picks "Show all charts". */
  async showAllCharts(): Promise<void> {
    await expectHydrated(this.chartsMenu, "onClick", "charts menu hydrated");
    await this.chartsMenu.click();
    await this.page.getByRole("menuitem", { name: "Show all charts" }).click();
  }

  resultsSummary(text: string): Locator {
    return this.page.getByText(text);
  }

  rowCell(text: string): Locator {
    return this.page.getByText(text);
  }

  async selectAllRowsOnPage(): Promise<void> {
    await this.page
      .getByRole("checkbox", { name: /select all rows on this page/i })
      .click();
  }

  async openAssociatedGenomes(): Promise<void> {
    await this.page
      .getByRole("complementary")
      .getByRole("button", { name: /genomes/i })
      .click();
  }
}
