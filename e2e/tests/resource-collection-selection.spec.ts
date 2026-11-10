import type { JsonOverride } from "../mocks/backends";
import { applyBackendMocks, expect, test } from "../mocks/backends";
import {
  emptyBackendFallbackOverrides,
  genomeScenarioOverrides,
} from "../fixtures/overrides";
import { ResourceCollectionPage } from "../pages";
import { e2eSignedInStatePath } from "../auth/storage-state";

test.use({ storageState: { cookies: [], origins: [] } });

/**
 * The selection column's header checkbox in the production build. The unit suite
 * renders DataTable without the React Compiler, which once memoized this header on
 * the table instance (created once, so never a new value) and froze it in its first
 * state: unchecked, labelled "Select all rows on this page", and toggling the page
 * on again when clicked. Only a compiled build shows that.
 */

const firstRow = { genome_id: "1282460.2049", genome_name: "Selected genome" };
const secondRow = { genome_id: "1282460.2050", genome_name: "Next genome" };

const pageOneOverride: JsonOverride = {
  url: /\/api\/data\/genome(?=[^#]*[?&]operation=collection(?:&|$))(?=[^#]*[?&]page=1(?:&|$))/,
  method: "GET",
  body: {
    rows: [firstRow, secondRow],
    total: 401,
    facets: {},
    page: 1,
    pageSize: 200,
  },
};

test("the header checkbox follows the page selection and the all-results selection", async ({
  page,
}) => {
  await applyBackendMocks(page, {
    overrides: [
      pageOneOverride,
      ...genomeScenarioOverrides,
      ...emptyBackendFallbackOverrides,
    ],
  });
  const collection = new ResourceCollectionPage(
    page,
    "genome",
    "genome",
    firstRow.genome_id,
    firstRow.genome_name,
  );
  const header = collection.headerCheckbox();

  await collection.goto("influenza");
  await expect(header).toHaveAccessibleName("Select all rows on this page");
  await expect(header).not.toBeChecked();

  // Part of the page.
  await collection.rowCheckbox(firstRow.genome_id).check();
  await expect(header).toBeChecked({ indeterminate: true });

  // The whole page; `check` fails if the header does not turn checked.
  await header.check();
  await expect(header).toHaveAccessibleName("Deselect all rows on this page");
  await expect(collection.rowCheckbox(secondRow.genome_id)).toBeChecked();

  // And clicked again, the page is cleared rather than selected a second time.
  await header.uncheck();
  await expect(header).toHaveAccessibleName("Select all rows on this page");
  await expect(collection.rowCheckbox(firstRow.genome_id)).not.toBeChecked();
  await expect(collection.rowCheckbox(secondRow.genome_id)).not.toBeChecked();

  // Every matching result.
  await header.check();
  await collection.selectAllResults(401);
  await expect(header).toHaveAccessibleName("Deselect all results");
  await expect(header).toBeChecked();
  await expect(collection.allResultsSelectedCount(401)).toBeVisible();

  await header.uncheck();
  await expect(header).toHaveAccessibleName("Select all rows on this page");
  await expect(collection.allResultsSelectedNotice(401)).toHaveCount(0);
  await expect(collection.rowCheckbox(firstRow.genome_id)).not.toBeChecked();
  await expect(collection.rowCheckbox(secondRow.genome_id)).not.toBeChecked();
});

test.describe("signed in", () => {
  test.use({ storageState: e2eSignedInStatePath });

  // Closing an action dialog hands focus back to the tile that opened it, not
  // the body (see expectEscapeReturnsFocusToTile).
  for (const { tile, dialog } of [
    { tile: "GROUP", dialog: "Add Genomes to Group" },
    { tile: "SERVICES", dialog: "Use selected Genomes in a service" },
    { tile: "COPY", dialog: "Copy selected Genomes (1)" },
  ]) {
    test(`Escape on the ${tile} dialog returns focus to ${tile}`, async ({
      page,
    }) => {
      await applyBackendMocks(page, {
        overrides: [
          pageOneOverride,
          ...genomeScenarioOverrides,
          ...emptyBackendFallbackOverrides,
        ],
      });
      const collection = new ResourceCollectionPage(
        page,
        "genome",
        "genome",
        firstRow.genome_id,
        firstRow.genome_name,
      );
      await collection.goto("influenza");
      await collection.rowCheckbox(firstRow.genome_id).check();

      await collection.expectEscapeReturnsFocusToTile(tile, dialog);
    });
  }
});
