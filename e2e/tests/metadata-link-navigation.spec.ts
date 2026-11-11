import { applyBackendMocks, expect, test } from "../mocks/backends";
import {
  emptyBackendFallbackOverrides,
  genomeFeatureScenarioOverrides,
  genomeScenarioOverrides,
  genomeSequenceScenarioOverrides,
} from "../fixtures/overrides";

/**
 * Follows the Genome Sequence `sequence_id` metadata link into the Feature collection.
 * `resolveLink` leaves the template's parentheses and commas unencoded (legal
 * sub-delims), so only a browser proves the RQL survives the hop.
 */
const sequenceId = "1282460.2049.con.0001";
const featureRql = `and(eq(annotation,PATRIC),eq(sequence_id,${sequenceId}),eq(feature_type,CDS))`;

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("metadata link navigation", () => {
  test("the Genome Sequence feature link lands on a populated Feature list", async ({
    page,
  }) => {
    await applyBackendMocks(page, {
      overrides: [
        ...genomeScenarioOverrides,
        ...genomeSequenceScenarioOverrides,
        ...genomeFeatureScenarioOverrides,
        ...emptyBackendFallbackOverrides,
      ],
    });

    await page.goto("/genome/1282460.2049?tab=sequences");
    await expect(page.getByText("JX869059").first()).toBeVisible();

    await page
      .getByRole("checkbox", { name: `Select row ${sequenceId}` })
      .check();

    const link = page.getByRole("link", { name: sequenceId });
    await expect(link).toHaveAttribute("href", `/feature?rql=${featureRql}`);

    // Assert containment: the Feature collection wraps the URL's RQL in its own
    // `eq(feature_id,*)` scope.
    const featureRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === "/api/data/genome_feature" &&
        url.searchParams.get("rql")?.includes(featureRql) === true
      );
    });
    await link.click();
    await featureRequest;

    await expect(page).toHaveURL(`/feature?rql=${featureRql}`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Features" }),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "fig|1282460.2049.peg.1" }),
    ).toBeVisible();
    await expect(page.getByText("No results found")).toHaveCount(0);
  });
});
