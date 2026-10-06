import { render } from "@testing-library/react";
import {
  featureCollectionOptions,
  featureListCollectionOptions,
} from "@/lib/feature-view";
import type { CollectionState } from "@/lib/views/collection-state";
import { FeatureCollection } from "../feature-collection";

interface CollectionProps {
  baseRql?: string;
  collectionOptions?: unknown;
  keywordMode?: string;
  serverKeywordMode?: string;
}

const { collectionProps } = vi.hoisted(() => ({
  collectionProps: { current: null as CollectionProps | null },
}));

vi.mock("@/components/views", () => ({
  EntityViewShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  FeatureResourceCollection: (props: CollectionProps) => {
    collectionProps.current = props;
    return null;
  },
}));

const bareState: CollectionState = { filters: {}, page: 1, sort: "unsorted" };

describe("FeatureCollection", () => {
  beforeEach(() => {
    collectionProps.current = null;
  });

  // Legacy BV-BRC scopes neither list to recent genomes, and that scope is a
  // cross-collection `genome()` join: 40–120 s on a keyword search and 44 s
  // on the bare list, against a few seconds and 18 s without it.
  it.each([
    ["the bare list", bareState],
    ["a keyword search", { ...bareState, keyword: "Dnak" }],
  ])("does not join %s to recent genomes", (_name, state) => {
    render(<FeatureCollection initialState={state} />);

    expect(collectionProps.current).not.toBeNull();
    expect(collectionProps.current?.baseRql).toBeUndefined();
  });

  it("lists features with legacy FeatureList's URL schema and exact keyword", () => {
    render(<FeatureCollection initialState={bareState} />);

    expect(collectionProps.current).toEqual(
      expect.objectContaining({
        collectionOptions: featureListCollectionOptions,
        keywordMode: "refine",
        serverKeywordMode: "exact",
      }),
    );
  });

  it("writes no removed-default marker on a Proteins search's URL", () => {
    // The Proteins search has no PATRIC default (`featureListOptionsFor`), so
    // its URL writes must not record one as removed (annotation=*).
    render(
      <FeatureCollection
        initialState={{ ...bareState, filters: { filter: ["protein"] } }}
      />,
    );

    expect(collectionProps.current?.collectionOptions).toBe(
      featureCollectionOptions,
    );
  });
});
