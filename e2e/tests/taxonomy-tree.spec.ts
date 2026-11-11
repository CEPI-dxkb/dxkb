import { test, expect, applyBackendMocks, type JsonOverride } from "../mocks/backends";
import {
  emptyBackendFallbackOverrides,
  taxonomyScenarioOverrides,
} from "../fixtures/overrides";

test.use({ storageState: { cookies: [], origins: [] } });

function childrenOverride(parentId: number, rows: Record<string, unknown>[]): JsonOverride {
  return {
    // (?![0-9]) keeps 234 from matching 2345.
    url: new RegExp(`/api/taxonomy-tree/children\\?parentId=${String(parentId)}(?![0-9])`),
    method: "GET",
    body: { rows },
  };
}

// One entry answers every child-count request; a parent with no qualifying children is
// absent, not 0, as the route reports it. Without it no row is expandable.
function childCountsOverride(counts: Record<number, number>): JsonOverride {
  return {
    url: /\/api\/taxonomy-tree\/child-counts(?:\?|$)/,
    method: "GET",
    body: { counts },
  };
}

const speciesChildren = [
  { taxon_id: 235, taxon_name: "Brucella abortus", taxon_rank: "species", parent_id: 234, genomes: 581 },
  { taxon_id: 236, taxon_name: "Brucella melitensis", taxon_rank: "species", parent_id: 234, genomes: 400 },
];

const abortusStrains = [
  { taxon_id: 99935, taxon_name: "Brucella abortus 544", taxon_rank: "strain", parent_id: 235, genomes: 2 },
];

test.describe("taxonomy tree tab", () => {
  test.beforeEach(async ({ page }) => {
    await applyBackendMocks(page, {
      overrides: [
        childCountsOverride({ 234: 2, 235: 1 }),
        childrenOverride(234, speciesChildren),
        childrenOverride(235, abortusStrains),
        ...taxonomyScenarioOverrides,
        ...emptyBackendFallbackOverrides,
      ],
    });
  });

  test("auto-expands genus, lazily expands a species to its strains, and opens the panel", async ({ page }) => {
    await page.goto("/taxonomy/234?tab=taxa-tree");

    await expect(page.getByRole("link", { name: "Brucella", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Brucella abortus", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Brucella melitensis" })).toBeVisible();

    const speciesRow = page.locator("tr", {
      has: page.getByRole("link", { name: "Brucella abortus", exact: true }),
    });
    await speciesRow.getByRole("button", { name: "Expand" }).click();

    const strainLink = page.getByRole("link", { name: "Brucella abortus 544" });
    await expect(strainLink).toBeVisible();

    const strainRow = page.locator("tr", { has: strainLink });
    await expect(strainRow.getByRole("button", { name: /Expand|Collapse/ })).toHaveCount(0);

    await strainRow.click();
    await expect(page.getByText("Taxon ID")).toBeVisible();
  });

  test("preserves a non-leaf's toggle after counts settle, collapse, and re-expansion", async ({ page }) => {
    await page.goto("/taxonomy/234?tab=taxa-tree");

    const speciesRow = page.locator("tr", {
      has: page.getByRole("link", { name: "Brucella abortus", exact: true }),
    });
    const expand = speciesRow.getByRole("button", { name: "Expand" });
    await expect(expand).toBeVisible();

    // A missing reactive count once briefly rendered this toggle, then removed it;
    // stability catches that.
    await expect(expand).toBeVisible();
    await expand.click();
    await expect(page.getByRole("link", { name: "Brucella abortus 544" })).toBeVisible();

    await speciesRow.getByRole("button", { name: "Collapse" }).click();
    await expect(page.getByRole("link", { name: "Brucella abortus 544" })).toHaveCount(0);
    await expect(expand).toBeVisible();

    await expand.click();
    await expect(page.getByRole("link", { name: "Brucella abortus 544" })).toBeVisible();
  });

  test("filters the loaded rows by name", async ({ page }) => {
    await page.goto("/taxonomy/234?tab=taxa-tree");
    await expect(page.getByRole("link", { name: "Brucella abortus", exact: true })).toBeVisible();

    await page.getByRole("searchbox", { name: "Search by taxonomy name" }).fill("melitensis");

    await expect(page.getByRole("link", { name: "Brucella melitensis" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Brucella abortus", exact: true })).toHaveCount(0);
  });
});
