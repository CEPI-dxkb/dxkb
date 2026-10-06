import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import type { CollectionState } from "@/lib/views/collection-state";
import { DomainsAndMotifsCollection } from "../domains-and-motifs/domains-and-motifs-collection";
import { EpitopeCollection } from "../epitope/epitope-collection";
import { ExperimentCollection } from "../experiment/experiment-collection";
import { ProteinStructureCollection } from "../protein-structure/protein-structure-collection";
import { SerologyCollection } from "../serology/serology-collection";
import { StrainCollection } from "../strain/strain-collection";
import { SurveillanceCollection } from "../surveillance/surveillance-collection";

interface CollectionProps {
  keywordMode?: string;
  serverKeywordMode?: string;
}

const { collectionProps } = vi.hoisted(() => ({
  collectionProps: { current: null as CollectionProps | null },
}));

vi.mock("@/components/views", () => {
  const capture = (props: CollectionProps) => {
    collectionProps.current = props;
    return null;
  };
  return {
    EntityViewShell: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    EpitopeResourceCollection: capture,
    ExperimentResourceCollection: capture,
    ProteinFeatureResourceCollection: capture,
    ProteinStructureResourceCollection: capture,
    SerologyResourceCollection: capture,
    StrainResourceCollection: capture,
    SurveillanceResourceCollection: capture,
  };
});

const state: CollectionState = { filters: {}, page: 1, sort: "unsorted" };

// Legacy BV-BRC's lists and the All Data Types counts send the keyword as
// typed (`keyword(H1N1)`); a token prefix is wider for some words and, since
// Solr does not split a wildcard term, far narrower for others (Strains
// `H1N1`: 260,889 exact, 76,178 as `H1N1*`).
describe.each<[string, () => ReactElement]>([
  ["Strains", () => <StrainCollection initialState={state} />],
  [
    "Domains and Motifs",
    () => <DomainsAndMotifsCollection initialState={state} />,
  ],
  ["Epitopes", () => <EpitopeCollection initialState={state} />],
  [
    "Protein Structures",
    () => <ProteinStructureCollection initialState={state} />,
  ],
  ["Surveillance", () => <SurveillanceCollection initialState={state} />],
  ["Serology", () => <SerologyCollection initialState={state} />],
  [
    "Experiments",
    () => <ExperimentCollection initialState={state} activeTab="experiments" />,
  ],
])("the %s list", (_name, renderList) => {
  beforeEach(() => {
    collectionProps.current = null;
  });

  it("sends its URL keyword exact and refines in the page", () => {
    render(renderList());

    expect(collectionProps.current).toEqual(
      expect.objectContaining({
        keywordMode: "refine",
        serverKeywordMode: "exact",
      }),
    );
  });
});
