import { render } from "@testing-library/react";
import { genomeCollectionOptions } from "@/lib/genome-view";
import type { CollectionState } from "@/lib/views/collection-state";
import { GenomeResourceCollection } from "../genome-resource-collection";

interface CapturedCollectionProps {
  profile: { serverKeywordMode?: string };
  state: CollectionState;
  filtersBesideRql?: readonly string[];
}

const customQuery =
  "and(in(taxon_lineage_ids,(3050294)),ne(genome_status,Deprecated))";

const { collectionProps, urlStateOverride } = vi.hoisted(() => ({
  collectionProps: { current: null as CapturedCollectionProps | null },
  // `null` serves the plain URL state (no rql); a test sets one to make the
  // mocked `useCollectionUrlState` return it.
  urlStateOverride: { current: null as CollectionState | null },
}));

vi.mock("@/hooks/views/use-collection-url-state", () => ({
  useCollectionUrlState: () => [
    urlStateOverride.current ?? { filters: {}, page: 1, sort: "unsorted" },
    vi.fn(),
  ],
}));
vi.mock("../resource-collection", () => ({
  ResourceCollection: (props: CapturedCollectionProps) => {
    collectionProps.current = props;
    return null;
  },
}));

describe("GenomeResourceCollection", () => {
  beforeEach(() => {
    collectionProps.current = null;
    urlStateOverride.current = null;
  });

  it("keeps the token-prefix keyword by default", () => {
    render(<GenomeResourceCollection />);

    expect(collectionProps.current?.profile.serverKeywordMode).toBeUndefined();
  });

  it("sends an exact keyword when the list asks for one", () => {
    render(<GenomeResourceCollection serverKeywordMode="exact" />);

    expect(collectionProps.current?.profile.serverKeywordMode).toBe("exact");
  });

  it("hands ResourceCollection the initial custom query and every genome facet beside it", () => {
    const linked: CollectionState = {
      filters: {},
      page: 1,
      sort: "unsorted",
      rql: customQuery,
    };
    // A URL state with a different query: the wrapper must read the initial
    // state, not this one.
    urlStateOverride.current = {
      filters: {},
      page: 1,
      sort: "unsorted",
      rql: "eq(genome_id,1)",
    };
    render(<GenomeResourceCollection initialState={linked} />);

    expect(collectionProps.current?.state.rql).toBe(customQuery);
    expect(collectionProps.current?.filtersBesideRql).toEqual(
      genomeCollectionOptions.friendlyFilters,
    );
  });

  it("hands ResourceCollection the URL custom query and every genome facet beside it", () => {
    urlStateOverride.current = {
      filters: {},
      page: 1,
      sort: "unsorted",
      rql: customQuery,
    };
    render(<GenomeResourceCollection />);

    expect(collectionProps.current?.state.rql).toBe(customQuery);
    expect(collectionProps.current?.filtersBesideRql).toEqual(
      genomeCollectionOptions.friendlyFilters,
    );
  });
});
