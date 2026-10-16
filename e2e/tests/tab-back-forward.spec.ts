import type { Page, Request } from "@playwright/test";

import {
  applyBackendMocks,
  expect,
  test,
  type JsonOverride,
} from "../mocks/backends";
import {
  emptyBackendFallbackOverrides,
  genomeScenarioOverrides,
  taxonGenomesScenarioOverrides,
} from "../fixtures/overrides";
import { GenomeMemberPage, TaxonPage } from "../pages";

// Back or Forward from a server-rendered tab renders the leaving tab one more
// time against the destination's URL: React flushes the popstate transition at
// sync priority, Next's InnerLayoutRouter keeps the previous page RSC for that
// commit (useDeferredValue), and useSearchParams() already returns the new URL.
// A collection in that frame used to drop its filter or page, show "Loading
// results..." and fetch rows for a URL that is not its own. The tab shells hold
// the content on the search it was rendered for (TabContentSearchParams).
// Only a browser reproduces the timing, so this spec watches every frame and
// every Data API read around the history step.

test.use({ storageState: { cookies: [], origins: [] } });

/** What one animation frame shows. */
interface Frame {
  search: string;
  /** Label of the view rail's `aria-current` tab. */
  current: string;
  loading: boolean;
  /** The table's "Showing X-Y of Z" summary, if one is on screen. */
  summary: string | null;
}

/**
 * Push `href` through the app router, as a tab or chart link does. The page must have hydrated.
 * `window.next.router` is Next's public router instance, exposed for debugging.
 */
async function routerPush(page: Page, href: string): Promise<void> {
  await page.evaluate((target) => {
    const { next } = window as unknown as {
      next: { router: { push: (href: string) => void } };
    };
    next.router.push(target);
  }, href);
}

/**
 * Take a history step and sample every frame until the rail has shown `destination` as the
 * current tab for half a second. The sampler starts in the same evaluate as the step, so it
 * sees the first frame after the popstate.
 */
async function stepAndSampleFrames(
  page: Page,
  step: "back" | "forward",
  destination: string,
): Promise<Frame[]> {
  return page.evaluate(
    ({ step, destination }) =>
      new Promise<Frame[]>((resolve) => {
        const frames: Frame[] = [];
        const start = performance.now();
        let arrivedAt: number | null = null;
        const sample = () => {
          const now = performance.now();
          const current =
            document
              .querySelector('nav[aria-label$=" views"] [aria-current="page"]')
              ?.textContent.trim() ?? "";
          const text = document.body.innerText;
          frames.push({
            search: location.search,
            current,
            loading: text.includes("Loading results..."),
            summary:
              /Showing [\d,]+-[\d,]+ of [\d,]+/.exec(text)?.[0] ?? null,
          });
          if (current !== destination) arrivedAt = null;
          else arrivedAt ??= now;
          const settled = arrivedAt !== null && now - arrivedAt >= 500;
          if (settled || now - start >= 5_000) resolve(frames);
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
        if (step === "back") history.back();
        else history.forward();
      }),
    { step, destination },
  );
}

/** Data API collection reads of `resource` made while `action` runs. */
async function collectionReads(
  page: Page,
  resource: string,
  action: () => Promise<void>,
): Promise<URL[]> {
  const reads: URL[] = [];
  const record = (request: Request) => {
    const url = new URL(request.url());
    if (
      url.pathname === `/api/data/${resource}` &&
      url.searchParams.get("operation") === "collection"
    ) {
      reads.push(url);
    }
  };
  page.on("request", record);
  try {
    await action();
  } finally {
    page.off("request", record);
  }
  return reads;
}

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
