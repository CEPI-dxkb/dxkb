import { render } from "@testing-library/react";
import { featureListCollectionOptions } from "@/lib/feature-view";
import { makeFeaturesView } from "../features";

const { featureProps } = vi.hoisted(() => ({
  featureProps: { current: null as Record<string, unknown> | null },
}));

vi.mock("@/components/views", () => ({
  FeatureResourceCollection: (props: Record<string, unknown>) => {
    featureProps.current = props;
    return null;
  },
}));

describe("taxon Features tab", () => {
  it("orders unsorted rows as legacy FeatureGrid does", () => {
    const FeaturesView = makeFeaturesView({
      scope: {
        kind: "lineage",
        taxon: {
          taxonId: 234,
          taxonName: "Brucella",
          lineageNames: ["Brucella"],
          lineageIds: [234],
          taxonRank: "genus",
          genomes: null,
        },
      },
    });

    render(<FeaturesView />);

    // Legacy `p3/widget/FeatureGrid.js` queryOptions:
    // sort(+genome_name,+accession,+start).
    expect(featureProps.current).toMatchObject({
      collectionOptions: featureListCollectionOptions,
      unsortedOrder: {
        field: "genome_name",
        direction: "asc",
        then: [
          { field: "accession", direction: "asc" },
          { field: "start", direction: "asc" },
        ],
      },
    });
  });
});
