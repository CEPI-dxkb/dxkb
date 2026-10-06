import { render } from "@testing-library/react";
import {
  featureCollectionOptions,
  featureListCollectionOptions,
} from "@/lib/feature-view";
import type { CollectionState } from "@/lib/views/collection-state";
import { FeatureResourceCollection } from "../feature-resource-collection";

interface CapturedCollectionProps {
  profile: { serverKeywordMode?: string };
  state: CollectionState;
  facetState?: CollectionState;
  filtersBesideRql?: readonly string[];
}

const { collectionProps, urlStateOptions } = vi.hoisted(() => ({
  collectionProps: { current: null as CapturedCollectionProps | null },
  urlStateOptions: { current: null as object | null },
}));

vi.mock("@/hooks/views/use-collection-url-state", () => ({
  useCollectionUrlState: (options: object) => {
    urlStateOptions.current = options;
    return [{ filters: {}, page: 1, sort: "unsorted" }, vi.fn()];
  },
}));
vi.mock("../resource-collection", () => ({
  ResourceCollection: (props: CapturedCollectionProps) => {
    collectionProps.current = props;
    return null;
  },
}));

const listState: CollectionState = {
  keyword: "Dnak",
  filters: { annotation: ["PATRIC"] },
  page: 1,
  sort: "unsorted",
};

describe("FeatureResourceCollection", () => {
  beforeEach(() => {
    collectionProps.current = null;
    urlStateOptions.current = null;
  });

  it("keeps the embedded schema and the prefix keyword by default", () => {
    render(<FeatureResourceCollection />);

    expect(urlStateOptions.current).toBe(featureCollectionOptions);
    expect(collectionProps.current?.profile.serverKeywordMode).toBeUndefined();
    expect(collectionProps.current?.facetState).toBe(
      collectionProps.current?.state,
    );
  });

  it("counts facets without the list's untouched PATRIC default", () => {
    render(
      <FeatureResourceCollection
        collectionOptions={featureListCollectionOptions}
        serverKeywordMode="exact"
        initialState={listState}
        keywordMode="refine"
      />,
    );

    expect(urlStateOptions.current).toBe(featureListCollectionOptions);
    expect(collectionProps.current?.state).toBe(listState);
    expect(collectionProps.current?.facetState).toEqual({
      ...listState,
      filters: {},
    });
    expect(collectionProps.current?.profile.serverKeywordMode).toBe("exact");
  });

  it("keeps the Proteins scope in the facet counts beside the untouched default", () => {
    // The Proteins search always adds filter=protein; only PATRIC is left out.
    const proteins: CollectionState = {
      ...listState,
      filters: { annotation: ["PATRIC"], filter: ["protein"] },
    };
    render(
      <FeatureResourceCollection
        collectionOptions={featureListCollectionOptions}
        serverKeywordMode="exact"
        initialState={proteins}
        keywordMode="refine"
      />,
    );

    expect(collectionProps.current?.state).toBe(proteins);
    expect(collectionProps.current?.facetState).toEqual({
      ...proteins,
      filters: { filter: ["protein"] },
    });
  });

  it("lets the user change the PATRIC default beside a link's rql", () => {
    const linked: CollectionState = {
      ...listState,
      keyword: undefined,
      rql: "eq(genome_id,83332.12)",
    };
    render(
      <FeatureResourceCollection
        collectionOptions={featureListCollectionOptions}
        initialState={linked}
      />,
    );
    expect(collectionProps.current?.filtersBesideRql).toEqual([
      "annotation",
      "filter",
    ]);

    render(
      <FeatureResourceCollection
        collectionOptions={featureListCollectionOptions}
        initialState={{
          ...linked,
          rql: "and(eq(genome_id,83332.12),eq(annotation,RefSeq))",
          filters: {},
        }}
      />,
    );
    expect(collectionProps.current?.filtersBesideRql).toEqual(["filter"]);
  });

  it("counts facets with every filter once the user picks one", () => {
    const picked: CollectionState = {
      ...listState,
      filters: { annotation: ["PATRIC"], feature_type: ["CDS"] },
    };
    render(
      <FeatureResourceCollection
        collectionOptions={featureListCollectionOptions}
        initialState={picked}
      />,
    );

    expect(collectionProps.current?.facetState).toBe(picked);
  });
});
