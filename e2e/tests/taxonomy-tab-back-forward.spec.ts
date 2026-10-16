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

// Back from a filtered taxon tab must keep the filter on the frame the tab is
// still on screen with the Overview's URL. Why that frame exists, and why only
// a browser shows it, is in e2e/support/tab-history.ts.

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Back and Forward from a filtered taxon tab", () => {
  // Taxon 11974's Genomes rows come from taxonGenomesScenarioOverrides; its
  // Overview is server-rendered from the loopback mock.
  const taxonId = "11974";
  const filteredGenomes = `/taxonomy/${taxonId}?tab=genomes&collection_year=2025`;
  const isFiltered = (read: URL) =>
    read.searchParams.get("rql")?.includes("eq(collection_year,2025)") === true;

  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...taxonGenomesScenarioOverrides,
        ...genomeScenarioOverrides,
        ...emptyBackendFallbackOverrides,
      ],
    });
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
    // The leaving tab may still be on screen for a frame with the Overview's
    // URL, but it must look as it did: filtered rows, no refresh.
    const staleFrames = frames.filter(
      (frame) => frame.search === "" && frame.current === "Genomes",
    );
    expect(staleFrames.filter((frame) => frame.loading)).toEqual([]);
    expect(
      backReads.filter((read) => !isFiltered(read)).map(String),
    ).toEqual([]);

    // Forward restores the filtered tab, and still asks for nothing unfiltered.
    // Its frames are not checked: the Overview has no collection to go stale.
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
