import { test, expect, applyBackendMocks } from "../../mocks/backends";
import { emptyBackendFallbackOverrides } from "../../fixtures/overrides";
import { TaxonPage } from "../../pages";

test.use({ storageState: { cookies: [], origins: [] } });

const serologyData = /\/api\/data\/serology(?:\?|$)/;
const SEROLOGY_TAXON_ID = "2955291"; // Alphainfluenzavirus influenzae — hasSerology = true

function buildSerologyRows(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `sero-${String(i).padStart(4, "0")}`,
    // sample_identifier is the first visible column — assert on it, not `id`
    // (the row key), which the table never renders as a cell.
    sample_identifier: `sample-${String(i)}`,
    host_common_name: "Domestic Cat",
    test_type: "ELISA/IDEXX Flu Ab",
    test_result: "Negative",
    collection_date: "2008-11-02T16:54:39Z",
  }));
}

test.describe("taxon serology tab", () => {
  test("renders serology rows for the taxon", async ({ page }) => {
    const rows = buildSerologyRows(3);

    await applyBackendMocks(page, {
      overrides: [
        {
          url: serologyData,
          method: "GET",
          body: {
            rows,
            total: 3,
            facets: {},
            page: 1,
            pageSize: 200,
          },
        },
        ...emptyBackendFallbackOverrides,
      ],
    });

    const taxon = new TaxonPage(page);
    await taxon.goto(SEROLOGY_TAXON_ID, "serology");
    await expect(taxon.resultsSummary("Showing 1-3 of 3 results")).toBeVisible({
      timeout: 10_000,
    });
    await expect(taxon.rowCell("sample-0")).toBeVisible();
    await expect(taxon.tabButton("Serology")).toBeVisible();
  });
});
