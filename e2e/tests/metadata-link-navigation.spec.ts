import { applyBackendMocks, expect, test } from "../mocks/backends";
import {
  emptyBackendFallbackOverrides,
  genomeFeatureScenarioOverrides,
  genomeScenarioOverrides,
  genomeSequenceScenarioOverrides,
} from "../fixtures/overrides";

/**
 * `DataField.link` templates are pinned as strings by
 * `src/constants/datafields/__tests__/metadata-links.test.ts`, and the rendered
 * `href` by the `info-panel-search` and `metadata-link` unit suites under
 * `src/components/detail-panel/__tests__/`. Neither follows the link. This spec
 * does, for the one rewritten target that carries raw RQL in its query string:
 * Genome Sequence's `sequence_id` → the Feature collection.
 *
 * It is here rather than in `genome-view.spec.ts` because what it guards is the
 * metadata-link contract (resolve → `Link` → server parse → gateway → rows),
 * not the Genome route family.
 *
 * Why a browser is required: `resolveLink` percent-encodes only the `{value}`
 * segment, so the template's own parentheses and commas travel unencoded. That
 * is safe — `(`, `)` and `,` are RFC 3986 sub-delims and legal unencoded in a
 * query component, so `Link` forwards the href verbatim and the server's
 * `searchParams` hands `parseFeatureCollectionState` exactly the template text,
 * which `validateRql("genome_feature", …)` round-trips unchanged. The value
 * segment is encoded exactly once and decoded exactly once, so the
 * double-encode/single-decode mismatch tracked elsewhere does not apply here.
 * All of that is a claim about behaviour, hence this test rather than a comment.
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

    // The gateway request is the proof the RQL survived the hop intact: a
    // mangled query string would either arrive re-encoded here or fail the
    // server-side validateRql before any request happened. The Feature
    // collection wraps the URL's RQL in its own `eq(feature_id,*)` scope, so
    // assert containment of the template rather than equality with it.
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
