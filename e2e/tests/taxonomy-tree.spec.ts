import { test, expect, applyBackendMocks, type JsonOverride } from "../mocks/backends";
import {
  emptyBackendFallbackOverrides,
  taxonomyScenarioOverrides,
} from "../fixtures/overrides";

test.use({ storageState: { cookies: [], origins: [] } });

// Children of a node arrive as a bare array with a Content-Range total. The tree
// pages Range until that total is reached; keeping each fixture <= 25 rows means a
// single page satisfies the loop (the mock ignores Range and returns the full set).
function childrenOverride(parentId: number, rows: Record<string, unknown>[]): JsonOverride {
  return {
    // parent_id<sep>ID where sep is a literal comma or its %2C encoding. Not [^0-9]+:
    // the "2" in "%2C" is a digit, so that would mis-split the encoded separator.
    // (?![0-9]) guards against matching a longer id (234 must not match 2345).
    // (?!\)) so this doesn't hijack the facet request's in(parent_id,(…)) form.
    url: new RegExp(`/taxonomy/\\?.*parent_id(?:,|%2C)${String(parentId)}(?![0-9])`),
    method: "GET",
    body: rows,
    headers: { "Content-Range": `items 0-${String(rows.length)}/${String(rows.length)}` },
  };
}

// The tree asks for every visible node's child count in one faceted request; the
// Data API answers in a `facet_counts` header (flat [id, count, …] array). Only
// nodes with a count > 0 get an expand arrow, so this must be mocked or no row is
// expandable. Registered before childrenOverride (first match wins) since its URL
// also contains parent_id.
function childCountsOverride(counts: Record<number, number>): JsonOverride {
  const entries = Object.entries(counts);
  const ids = entries.map(([id]) => id).join(",");
  const encodedIds = entries.map(([id]) => id).join("(?:,|%2C)");
  const flat = entries.flatMap(([id, n]) => [id, n]);
  const open = "(?:%28|\\()";
  const close = "(?:%29|\\))";
  return {
    url: new RegExp(
      `/taxonomy/\\?.*in${open}parent_id(?:,|%2C)${open}${encodedIds}${close}${close}.*facet`,
      "i",
    ),
    method: "GET",
    body: [],
    headers: {
      "Content-Range": "items 0-0/0",
      facet_counts: JSON.stringify({ facet_fields: { parent_id: flat } }),
      "Access-Control-Expose-Headers": "facet_counts, Content-Range",
      "x-mocked-parent-ids": ids,
    },
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
      // Facet child-counts first (its URL also has parent_id, so it must win over
      // childrenOverride), then specific children, then permissive for the rest.
      // 235 has strains (→ expand arrow), 236 has none.
      overrides: [
        childCountsOverride({ 234: 2 }),
        childCountsOverride({ 235: 1, 236: 0 }),
        childCountsOverride({ 235: 1 }),
        childCountsOverride({ 236: 0 }),
        childrenOverride(234, speciesChildren),
        childrenOverride(235, abortusStrains),
        ...taxonomyScenarioOverrides,
        ...emptyBackendFallbackOverrides,
      ],
    });
  });

  test("auto-expands genus, lazily expands a species to its strains, and opens the panel", async ({ page }) => {
    await page.goto("/taxonomy/234?tab=taxa-tree");

    // Root genus row + auto-expanded species children.
    await expect(page.getByRole("link", { name: "Brucella", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Brucella abortus", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Brucella melitensis" })).toBeVisible();

    // Expand the species → its strain children lazy-load beneath it.
    const speciesRow = page.locator("tr", {
      has: page.getByRole("link", { name: "Brucella abortus", exact: true }),
    });
    await speciesRow.getByRole("button", { name: "Expand" }).click();

    const strainLink = page.getByRole("link", { name: "Brucella abortus 544" });
    await expect(strainLink).toBeVisible();

    // Strain is a leaf — no expand/collapse toggle.
    const strainRow = page.locator("tr", { has: strainLink });
    await expect(strainRow.getByRole("button", { name: /Expand|Collapse/ })).toHaveCount(0);

    // Clicking the row body opens the detail panel (the "Taxon ID" label only
    // appears in the panel, never in the tree's Name/Rank/Genomes columns).
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

    // A missing reactive count briefly rendered this toggle and then removed it
    // when the count query became disabled. Stability catches that initial-load regression.
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
