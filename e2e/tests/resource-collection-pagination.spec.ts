import type { JsonOverride } from "../mocks/backends";
import { applyBackendMocks, expect, test } from "../mocks/backends";
import {
  emptyBackendFallbackOverrides,
  epitopeScenarioOverrides,
  genomeFeatureScenarioOverrides,
  genomeScenarioOverrides,
  proteinFeatureScenarioOverrides,
  serologyScenarioOverrides,
  surveillanceScenarioOverrides,
} from "../fixtures/overrides";

// This spec parametrizes over six different resource collection pages; each
// case's own memberOverride/collectionOverrides win first-match, so the
// bundles below only need to cover shell rendering, not the exact assertions.
const resourceCollectionOverrides = [
  ...genomeScenarioOverrides,
  ...genomeFeatureScenarioOverrides,
  ...epitopeScenarioOverrides,
  ...surveillanceScenarioOverrides,
  ...proteinFeatureScenarioOverrides,
  ...serologyScenarioOverrides,
  ...emptyBackendFallbackOverrides,
];
import { ResourceCollectionPage } from "../pages";

test.use({ storageState: { cookies: [], origins: [] } });

const cases = [
  {
    route: "genome",
    resource: "genome",
    keyword: "influenza",
    id: "1282460.2049",
    detailText: "Selected genome",
    firstRow: {
      genome_id: "1282460.2049",
      genome_name: "Selected genome",
    },
    secondRow: { genome_id: "1282460.2050", genome_name: "Next genome" },
  },
  {
    route: "feature",
    resource: "genome_feature",
    keyword: "influenza",
    id: "PATRIC.1282460.2049.JX869059.CDS.1.100.fwd",
    detailText: "Selected feature",
    firstRow: {
      feature_id: "PATRIC.1282460.2049.JX869059.CDS.1.100.fwd",
      patric_id: "fig|1282460.2049.peg.1",
      product: "Selected feature",
    },
    secondRow: {
      feature_id: "PATRIC.1282460.2049.JX869059.CDS.101.200.fwd",
      patric_id: "fig|1282460.2049.peg.2",
      product: "Next feature",
    },
  },
  {
    route: "epitope",
    resource: "epitope",
    keyword: "influenza",
    id: "15780",
    detailText: "SELECTED",
    firstRow: { epitope_id: "15780", epitope_sequence: "SELECTED" },
    secondRow: { epitope_id: "15781", epitope_sequence: "NEXT" },
  },
  {
    route: "surveillance",
    resource: "surveillance",
    keyword: "influenza",
    id: "surveillance-backend-901",
    detailText: "selected-sample",
    firstRow: {
      id: "surveillance-backend-901",
      sample_identifier: "selected-sample",
      pathogen_test_type: ["PCR"],
    },
    secondRow: {
      id: "surveillance-backend-902",
      sample_identifier: "next-sample",
      pathogen_test_type: ["PCR"],
    },
  },
  {
    route: "domains-and-motifs",
    resource: "protein_feature",
    keyword: "domain",
    id: "protein-feature-backend-901",
    detailText: "Selected domain",
    firstRow: {
      id: "protein-feature-backend-901",
      patric_id: "fig|1282460.2049.peg.1",
      product: "Selected domain",
    },
    secondRow: {
      id: "protein-feature-backend-902",
      patric_id: "fig|1282460.2049.peg.2",
      product: "Next domain",
    },
  },
  {
    route: "serology",
    resource: "serology",
    keyword: "influenza",
    id: "serology-backend-901",
    detailText: "selected-serology",
    firstRow: {
      id: "serology-backend-901",
      sample_identifier: "selected-serology",
      test_type: "ELISA",
    },
    secondRow: {
      id: "serology-backend-902",
      sample_identifier: "next-serology",
      test_type: "ELISA",
    },
  },
] as const;

for (const testCase of cases) {
  test(`${testCase.route} preserves selection and prefetches the next page`, async ({
    page,
  }) => {
    const collectionRequests: number[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        url.pathname === `/api/data/${testCase.resource}` &&
        url.searchParams.get("operation") === "collection"
      ) {
        collectionRequests.push(Number(url.searchParams.get("page")));
      }
    });
    const collectionOverrides: JsonOverride[] = [
      { page: 1, row: testCase.firstRow },
      { page: 2, row: testCase.secondRow },
    ].map(({ page: requestedPage, row }) => ({
      url: new RegExp(
        `/api/data/${testCase.resource}(?=[^#]*[?&]operation=collection(?:&|$))(?=[^#]*[?&]page=${String(requestedPage)}(?:&|$))`,
      ),
      method: "GET",
      body: {
        rows: [row],
        total: 401,
        facets: {},
        page: requestedPage,
        pageSize: 200,
      },
    }));
    const memberOverride: JsonOverride = {
      url: new RegExp(
        `/api/data/${testCase.resource}\\?(?=.*operation=member)`,
      ),
      method: "GET",
      body: { row: testCase.firstRow },
    };
    await applyBackendMocks(page, {
      overrides: [
        memberOverride,
        ...collectionOverrides,
        ...resourceCollectionOverrides,
      ],
    });
    const collectionPage = new ResourceCollectionPage(
      page,
      testCase.route,
      testCase.resource,
      testCase.id,
      testCase.detailText,
    );

    await collectionPage.goto(testCase.keyword);
    await expect.poll(() => collectionRequests).toContain(2);
    await collectionPage.selectRow();
    await collectionPage.goToPage(2);
    await collectionPage.expectSelectionPreserved();
    await collectionPage.goToPage(1);
    await collectionPage.expectSelectedRowChecked();
  });
}

test("shows the loading skeleton, centered under the header checkbox, for a page that was not prefetched", async ({
  page,
}) => {
  const rows = [1, 2, 3].map((number) => ({
    genome_id: `1282460.${String(2048 + number)}`,
    genome_name: `Genome on page ${String(number)}`,
  }));
  // Four pages, so page 3 is one the prefetch (page 2, from page 1) never reaches.
  const total = 650;
  await applyBackendMocks(page, {
    overrides: [
      ...rows.map((row, index) => ({
        url: new RegExp(
          `/api/data/genome(?=[^#]*[?&]operation=collection(?:&|$))(?=[^#]*[?&]page=${String(index + 1)}(?:&|$))`,
        ),
        method: "GET",
        body: { rows: [row], total, facets: {}, page: index + 1, pageSize: 200 },
      })),
      ...resourceCollectionOverrides,
    ],
  });
  // Hold page 3 so the state between the click and its rows can be observed.
  // Registered after the mocks, so it is matched first.
  let releasePageThree!: () => void;
  const pageThreeHeld = new Promise<void>((resolve) => {
    releasePageThree = resolve;
  });
  await page.route(
    (url) =>
      url.pathname === "/api/data/genome" &&
      url.searchParams.get("page") === "3",
    async (route) => {
      await pageThreeHeld;
      await route.fallback();
    },
  );
  const collection = new ResourceCollectionPage(
    page,
    "genome",
    "genome",
    rows[0].genome_id,
    rows[0].genome_name,
  );

  await collection.goto("influenza");
  await expect(collection.rowSkeletons()).toHaveCount(0);
  await collection.goToPage(3);

  // The page being left is not shown as if it were page 3; the skeleton is,
  // and the previous total keeps the pager and the range in place.
  await expect(collection.rowSkeletons().first()).toBeVisible();
  await expect(collection.rowCheckbox(rows[0].genome_id)).toHaveCount(0);
  await expect(collection.resultRange(401, 600, 650)).toBeVisible();
  await expect(collection.pager()).toBeVisible();

  // The selection column's skeleton sits where the checkboxes do.
  const headerCheckbox = await collection.headerCheckbox().boundingBox();
  const selectionSkeleton = await collection
    .selectionCellSkeleton()
    .boundingBox();
  if (!headerCheckbox || !selectionSkeleton) {
    throw new Error("Expected the header checkbox and its skeleton on screen.");
  }
  expect(
    Math.abs(
      headerCheckbox.x +
        headerCheckbox.width / 2 -
        (selectionSkeleton.x + selectionSkeleton.width / 2),
    ),
  ).toBeLessThan(1);

  releasePageThree();
  await expect(collection.rowCheckbox(rows[2].genome_id)).toBeVisible();
  await expect(collection.rowSkeletons()).toHaveCount(0);
});
