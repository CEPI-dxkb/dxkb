import { expect, type Page, type Request } from "@playwright/test";
import { CollectionToolbar } from "./collection-toolbar";

export class DomainsAndMotifsPage {
  constructor(readonly page: Page) {}

  async gotoForGenome(genomeId: string): Promise<Request> {
    const collectionRequest = this.page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === "/api/data/protein_feature" &&
        url.searchParams.get("operation") === "collection"
      );
    });

    await this.page.goto(
      `/domains-and-motifs?genome_id=${encodeURIComponent(genomeId)}`,
    );
    return collectionRequest;
  }

  async expectProteinFeature(product: string, patricId: string): Promise<void> {
    await expect(this.page.getByText(product)).toBeVisible();
    await expect(
      this.page.getByRole("link", { name: patricId }),
    ).toHaveAttribute("href", `/feature/${encodeURIComponent(patricId)}`);
  }

  async expectFiltersAvailable(): Promise<void> {
    await expect(new CollectionToolbar(this.page).filtersButton()).toBeVisible();
  }

  async expectLegacyRedirect(
    legacyPath: string,
    query: string,
  ): Promise<void> {
    await this.page.goto(`/view/${legacyPath}/?${query}`);
    await expect(this.page).toHaveURL(`/domains-and-motifs?${query}`);
  }
}
