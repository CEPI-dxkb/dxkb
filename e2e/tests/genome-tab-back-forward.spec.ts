import {
  applyBackendMocks,
  expect,
  test,
  type JsonOverride,
} from "../mocks/backends";
import {
  emptyBackendFallbackOverrides,
  genomeScenarioOverrides,
} from "../fixtures/overrides";
import { GenomeMemberPage } from "../pages";
import {
  collectionReads,
  routerPush,
  stepAndSampleFrames,
  type Frame,
} from "../support/tab-history";

// Back from a paged member tab must keep the page on the frame the tab is
// still on screen with the overview's URL. Why that frame exists, and why only
// a browser shows it, is in e2e/support/tab-history.ts.

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Back and Forward from a paged member tab", () => {
  const genomeId = "1282460.2049";
  const pagedFeatures = `/genome/${genomeId}?tab=features&features.page=2`;
  const featureTotal = 450;
  const readPage = (read: URL) => read.searchParams.get("page") ?? "1";

  // Three rows per page, named for the page they were read for, out of enough
  // features for a second page to exist.
  const pagedFeatureOverride: JsonOverride = {
    url: /\/api\/data\/genome_feature(?:\?|$)/,
    method: "GET",
    body: ({ requestUrl }) => {
      const page = Number(readPage(new URL(requestUrl)));
      return {
        rows: Array.from({ length: 3 }, (_, i) => ({
          feature_id: `feature-p${String(page)}-${String(i)}`,
          patric_id: `fig|${genomeId}.peg.${String(page * 100 + i)}`,
          genome_id: genomeId,
          genome_name: "Fixture genome",
          feature_type: "CDS",
          product: `page ${String(page)} product ${String(i)}`,
        })),
        total: featureTotal,
        facets: {},
        page,
        pageSize: 200,
      };
    },
  };

  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        pagedFeatureOverride,
        ...genomeScenarioOverrides,
        ...emptyBackendFallbackOverrides,
      ],
    });
  });

  test("the Features tab keeps its page while Back returns to the overview", async ({
    page,
  }) => {
    const genome = new GenomeMemberPage(page);
    const pageTwoRow = page.getByRole("row", { name: /page 2 product 0/ });
    await genome.goto(genomeId);
    await genome.waitForHydration();

    await routerPush(page, pagedFeatures);
    await genome.expectRow(/page 2 product 0/);
    await expect(page.getByText("Showing 201-203 of 450")).toBeVisible();

    let frames: Frame[] = [];
    const backReads = await collectionReads(page, "genome_feature", async () => {
      frames = await stepAndSampleFrames(page, "back", "Overview");
    });
    await expect(page).toHaveURL(`/genome/${genomeId}`);
    await expect(genome.heading).toBeVisible();
    // A stale frame of the Features tab must still show page 2.
    const staleFrames = frames.filter(
      (frame) => frame.search === "" && frame.current === "Features",
    );
    expect(
      staleFrames.filter(
        (frame) => frame.loading || frame.summary?.startsWith("Showing 1-"),
      ),
    ).toEqual([]);
    expect(
      backReads.filter((read) => readPage(read) === "1").map(String),
    ).toEqual([]);

    const forwardReads = await collectionReads(
      page,
      "genome_feature",
      async () => {
        await stepAndSampleFrames(page, "forward", "Features");
      },
    );
    await expect(page).toHaveURL(pagedFeatures);
    await expect(pageTwoRow).toBeVisible();
    expect(
      forwardReads.filter((read) => readPage(read) === "1").map(String),
    ).toEqual([]);
  });
});
