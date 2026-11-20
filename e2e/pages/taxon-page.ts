import { expect, type Locator, type Page } from "@playwright/test";

import { CollectionToolbar } from "./collection-toolbar";
import { ErrorAlert } from "./error-alert";
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
