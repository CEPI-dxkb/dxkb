import { render, screen } from "@testing-library/react";
import type { CollectionState } from "@/lib/views/collection-state";

vi.mock("../feature-collection", () => ({
  FeatureCollection: ({ initialState }: { initialState: CollectionState }) => (
    <output data-testid="filters">{JSON.stringify(initialState.filters)}</output>
  ),
}));

import FeatureCollectionPage from "../page";

async function renderedFilters(searchParams: Record<string, string>) {
  render(
    await FeatureCollectionPage({
      searchParams: Promise.resolve(searchParams),
    }),
  );
  return JSON.parse(screen.getByTestId("filters").textContent) as unknown;
}

describe("Feature collection route", () => {
  it("selects legacy FeatureList's annotation=PATRIC default", async () => {
    await expect(renderedFilters({ keyword: "Dnak" })).resolves.toEqual({
      annotation: ["PATRIC"],
    });
  });

  it("lists every annotation once the default is removed", async () => {
    await expect(
      renderedFilters({ keyword: "Dnak", annotation: "*" }),
    ).resolves.toEqual({});
  });

  it("gives the Proteins search no removable default", async () => {
    // filter=protein already pins eq(annotation,PATRIC) (proteinFeatureRql), so
    // a removable PATRIC chip would change nothing; legacy ProteinList's
    // removal sends the same query (2,122,451 rows for Dnak).
    await expect(
      renderedFilters({ keyword: "Dnak", filter: "protein" }),
    ).resolves.toEqual({ filter: ["protein"] });
  });

  it("keeps the default beside another feature-type scope", async () => {
    await expect(
      renderedFilters({ keyword: "Dnak", filter: "CDS" }),
    ).resolves.toEqual({ annotation: ["PATRIC"], filter: ["CDS"] });
  });

  it("keeps the default beside an explicit RQL", async () => {
    // Legacy FeatureList applies it to a link's query too.
    await expect(
      renderedFilters({ rql: "eq(genome_id,83332.12)" }),
    ).resolves.toEqual({ annotation: ["PATRIC"] });
  });

  it("lets an explicit RQL that picks an annotation replace the default", async () => {
    await expect(
      renderedFilters({
        rql: "and(eq(genome_id,83332.12),eq(annotation,RefSeq))",
      }),
    ).resolves.toEqual({});
  });
});
