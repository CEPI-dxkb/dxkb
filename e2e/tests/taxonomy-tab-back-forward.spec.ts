import type { Page } from "@playwright/test";

import { applyBackendMocks, expect, test } from "../mocks/backends";
import {
  emptyBackendFallbackOverrides,
  genomeScenarioOverrides,
  taxonGenomesScenarioOverrides,
} from "../fixtures/overrides";
import { TaxonPage } from "../pages";
import {
  collectionReads,
  routerPush,
  stepAndSampleFrames,
  type Frame,
} from "../support/tab-history";

// The stale-frame rationale is in e2e/support/tab-history.ts.

test.use({ storageState: { cookies: [], origins: [] } });

const taxonId = "11974";

async function mockTaxonBackends(page: Page): Promise<void> {
  await applyBackendMocks(page, {
    overrides: [
      ...taxonGenomesScenarioOverrides,
      ...genomeScenarioOverrides,
      ...emptyBackendFallbackOverrides,
    ],
  });
}

test.describe("Back and Forward from a filtered taxon tab", () => {
  const filteredGenomes = `/taxonomy/${taxonId}?tab=genomes&collection_year=2025`;
  const isFiltered = (read: URL) =>
    read.searchParams.get("rql")?.includes("eq(collection_year,2025)") === true;

  test.beforeEach(async ({ page }) => {
    await mockTaxonBackends(page);
  });

  test("the Genomes tab keeps its filter while Back returns to the Overview", async ({
    page,
  }) => {
    const taxon = new TaxonPage(page);
    const genomeRow = page.getByRole("row", { name: /Select row 11983\.1 / });
    await taxon.goto(taxonId);
    await taxon.viewNav.waitForHydration();

    const pushReads = await collectionReads(page, "genome", async () => {
      await routerPush(page, filteredGenomes);
      await expect(genomeRow).toBeVisible();
    });
    expect(pushReads.length).toBeGreaterThan(0);
    expect(pushReads.every(isFiltered)).toBe(true);
    await expect(taxon.tabButton("Genomes")).toHaveAttribute(
      "aria-current",
      "page",
    );

    let frames: Frame[] = [];
    const backReads = await collectionReads(page, "genome", async () => {
      frames = await stepAndSampleFrames(page, "back", "Overview");
    });
    await expect(page).toHaveURL(`/taxonomy/${taxonId}`);
    await expect(taxon.tabButton("Overview")).toHaveAttribute(
      "aria-current",
      "page",
    );
    const staleFrames = frames.filter(
      (frame) => frame.search === "" && frame.current === "Genomes",
    );
    expect(staleFrames.filter((frame) => frame.loading)).toEqual([]);
    expect(
      backReads.filter((read) => !isFiltered(read)).map(String),
    ).toEqual([]);

    const forwardReads = await collectionReads(page, "genome", async () => {
      await stepAndSampleFrames(page, "forward", "Genomes");
    });
    await expect(page).toHaveURL(filteredGenomes);
    await expect(genomeRow).toBeVisible();
    expect(
      forwardReads.filter((read) => !isFiltered(read)).map(String),
    ).toEqual([]);
  });
});

test.describe("Overview stat tiles", () => {
  test.beforeEach(async ({ page }) => {
    await mockTaxonBackends(page);
  });

  test("the Genomes / Segments tile opens the Genomes tab", async ({ page }) => {
    const taxon = new TaxonPage(page);
    await taxon.goto(taxonId);
    await taxon.viewNav.waitForHydration();
    await expect(taxon.tabButton("Overview")).toHaveAttribute(
      "aria-current",
      "page",
    );

    await taxon.statTile("Genomes / Segments").click();

    await expect(page).toHaveURL(`/taxonomy/${taxonId}?tab=genomes`);
    await expect(taxon.tabButton("Genomes")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
