import { render } from "@testing-library/react";
import { GenomeResourceCollection } from "../genome-resource-collection";

interface CapturedCollectionProps {
  profile: { serverKeywordMode?: string };
}

const { collectionProps } = vi.hoisted(() => ({
  collectionProps: { current: null as CapturedCollectionProps | null },
}));

vi.mock("@/hooks/views/use-collection-url-state", () => ({
  useCollectionUrlState: () => [
    { filters: {}, page: 1, sort: "unsorted" },
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
  });

  it("keeps the token-prefix keyword by default", () => {
    render(<GenomeResourceCollection />);

    expect(collectionProps.current?.profile.serverKeywordMode).toBeUndefined();
  });

  it("sends an exact keyword when the list asks for one", () => {
    render(<GenomeResourceCollection serverKeywordMode="exact" />);

    expect(collectionProps.current?.profile.serverKeywordMode).toBe("exact");
  });
});
