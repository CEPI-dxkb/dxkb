import { render } from "@testing-library/react";
import type { CollectionState } from "@/lib/views/collection-state";
import { FeatureCollection } from "../feature-collection";

const { collectionProps } = vi.hoisted(() => ({
  collectionProps: { current: null as { baseRql?: string } | null },
}));

vi.mock("@/components/views", () => ({
  EntityViewShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  FeatureResourceCollection: (props: { baseRql?: string }) => {
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
});
