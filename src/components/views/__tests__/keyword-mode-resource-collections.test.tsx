import type { ComponentType } from "react";
import { render } from "@testing-library/react";
import { EpitopeResourceCollection } from "../epitope-resource-collection";
import { ExperimentResourceCollection } from "../experiment-resource-collection";
import { ProteinFeatureResourceCollection } from "../protein-feature-resource-collection";
import { ProteinStructureResourceCollection } from "../protein-structure-resource-collection";
import { SerologyResourceCollection } from "../serology-resource-collection";
import { StrainResourceCollection } from "../strain-resource-collection";
import { SurveillanceResourceCollection } from "../surveillance-resource-collection";

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

type KeywordModeCollection = ComponentType<{
  serverKeywordMode?: "exact" | "prefix";
}>;

describe.each<[string, KeywordModeCollection]>([
  ["StrainResourceCollection", StrainResourceCollection],
  ["ProteinFeatureResourceCollection", ProteinFeatureResourceCollection],
  ["EpitopeResourceCollection", EpitopeResourceCollection],
  ["ProteinStructureResourceCollection", ProteinStructureResourceCollection],
  ["SurveillanceResourceCollection", SurveillanceResourceCollection],
  ["SerologyResourceCollection", SerologyResourceCollection],
  ["ExperimentResourceCollection", ExperimentResourceCollection],
])("%s", (_name, Collection) => {
  beforeEach(() => {
    collectionProps.current = null;
  });

  it("keeps the token-prefix keyword by default", () => {
    render(<Collection />);

    expect(collectionProps.current).not.toBeNull();
    expect(collectionProps.current?.profile.serverKeywordMode).toBeUndefined();
  });

  it("sends an exact keyword when the list asks for one", () => {
    render(<Collection serverKeywordMode="exact" />);

    expect(collectionProps.current?.profile.serverKeywordMode).toBe("exact");
  });
});
