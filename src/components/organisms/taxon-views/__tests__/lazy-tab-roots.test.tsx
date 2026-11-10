import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";

import {
  LazyBacterialPhylogenyPanel,
  LazyEpitopeResourceCollection,
  LazyExperimentResourceCollection,
  LazyFeatureResourceCollection,
  LazyGenomeResourceCollection,
  LazyInteractionsSubviewShell,
  LazyProteinFeatureResourceCollection,
  LazyProteinStructureResourceCollection,
  LazyResourceChildCollection,
  LazySerologyResourceCollection,
  LazyStrainResourceCollection,
  LazySurveillanceResourceCollection,
  LazyTaxonomyTreePanel,
  LazyViralPhylogenyPanel,
} from "../lazy-tab-roots";

// Each stub shows its props, to confirm the wrapper reached the real module path, not the barrel.
function CollectionStub({
  testId,
  baseRql,
  keywordMode,
}: {
  testId: string;
  baseRql: string;
  keywordMode?: string;
}) {
  return (
    <div data-testid={testId} data-keyword-mode={keywordMode}>
      {baseRql}
    </div>
  );
}

function collectionStub(testId: string) {
  return function Stub(props: { baseRql: string; keywordMode?: string }) {
    return <CollectionStub testId={testId} {...props} />;
  };
}

vi.mock("@/components/views/genome-resource-collection", () => ({
  GenomeResourceCollection: collectionStub("genome-collection"),
}));
vi.mock("@/components/views/feature-resource-collection", () => ({
  FeatureResourceCollection: collectionStub("feature-collection"),
}));
vi.mock("@/components/views/strain-resource-collection", () => ({
  StrainResourceCollection: collectionStub("strain-collection"),
}));
vi.mock("@/components/views/epitope-resource-collection", () => ({
  EpitopeResourceCollection: collectionStub("epitope-collection"),
}));
vi.mock("@/components/views/experiment-resource-collection", () => ({
  ExperimentResourceCollection: collectionStub("experiment-collection"),
}));
vi.mock("@/components/views/serology-resource-collection", () => ({
  SerologyResourceCollection: collectionStub("serology-collection"),
}));
vi.mock("@/components/views/surveillance-resource-collection", () => ({
  SurveillanceResourceCollection: collectionStub("surveillance-collection"),
}));
vi.mock("@/components/views/protein-structure-resource-collection", () => ({
  ProteinStructureResourceCollection: collectionStub(
    "protein-structure-collection",
  ),
}));
vi.mock("@/components/views/protein-feature-resource-collection", () => ({
  ProteinFeatureResourceCollection: collectionStub("protein-feature-collection"),
}));
vi.mock("@/components/views/resource-child-collection", () => ({
  ResourceChildCollection: ({
    urlKey,
    resource,
    rql,
  }: {
    urlKey: string;
    resource: string;
    rql: string;
  }) => (
    <div data-testid="child-collection" data-url-key={urlKey} data-resource={resource}>
      {rql}
    </div>
  ),
}));
vi.mock("@/components/interactions/interactions-subview-shell", () => ({
  InteractionsSubviewShell: ({
    rql,
    guideUrl,
  }: {
    rql: string;
    guideUrl?: string;
  }) => (
    <div data-testid="interactions-shell" data-guide={guideUrl}>
      {rql}
    </div>
  ),
}));
vi.mock("@/components/phylogeny/bacterial-phylogeny-panel", () => ({
  BacterialPhylogenyPanel: ({
    taxonId,
    taxonName,
  }: {
    taxonId: number;
    taxonName: string;
  }) => (
    <div data-testid="bacterial-panel" data-taxon-id={taxonId}>
      {taxonName}
    </div>
  ),
}));
vi.mock("@/components/phylogeny/viral-phylogeny-panel", () => ({
  ViralPhylogenyPanel: ({
    taxonId,
    taxonName,
  }: {
    taxonId: number;
    taxonName: string;
  }) => (
    <div data-testid="viral-panel" data-taxon-id={taxonId}>
      {taxonName}
    </div>
  ),
}));
vi.mock("@/components/taxonomy/taxonomy-tree-panel", () => ({
  TaxonomyTreePanel: ({
    taxa,
    phylogenyTaxonIds,
  }: {
    taxa: { taxonName: string }[];
    phylogenyTaxonIds: readonly number[];
  }) => (
    <div
      data-testid="taxonomy-tree"
      data-phylogeny-ids={phylogenyTaxonIds.join(",")}
    >
      {taxa.map((taxon) => taxon.taxonName).join(", ")}
    </div>
  ),
}));

describe("lazy tab roots", () => {
  const baseRql = "eq(taxon_lineage_ids,1234)";

  it.each<[string, ReactElement, string]>([
    [
      "genome",
      <LazyGenomeResourceCollection key="genome" baseRql={baseRql} keywordMode="loaded" />,
      "genome-collection",
    ],
    [
      "feature",
      <LazyFeatureResourceCollection key="feature" baseRql={baseRql} keywordMode="loaded" />,
      "feature-collection",
    ],
    [
      "strain",
      <LazyStrainResourceCollection key="strain" baseRql={baseRql} keywordMode="loaded" />,
      "strain-collection",
    ],
    [
      "epitope",
      <LazyEpitopeResourceCollection key="epitope" baseRql={baseRql} keywordMode="loaded" />,
      "epitope-collection",
    ],
    [
      "experiment",
      <LazyExperimentResourceCollection key="experiment" baseRql={baseRql} keywordMode="loaded" />,
      "experiment-collection",
    ],
    [
      "serology",
      <LazySerologyResourceCollection key="serology" baseRql={baseRql} keywordMode="loaded" />,
      "serology-collection",
    ],
    [
      "surveillance",
      <LazySurveillanceResourceCollection key="surveillance" baseRql={baseRql} keywordMode="loaded" />,
      "surveillance-collection",
    ],
    [
      "protein structure",
      <LazyProteinStructureResourceCollection
        key="protein-structure"
        baseRql={baseRql}
        keywordMode="loaded"
      />,
      "protein-structure-collection",
    ],
    [
      "protein feature",
      <LazyProteinFeatureResourceCollection
        key="protein-feature"
        baseRql={baseRql}
        keywordMode="loaded"
      />,
      "protein-feature-collection",
    ],
  ])("loads the %s collection with its props", async (_label, element, testId) => {
    render(element);

    const collection = await screen.findByTestId(testId);
    expect(collection).toHaveTextContent(baseRql);
    expect(collection).toHaveAttribute("data-keyword-mode", "loaded");
  });

  it("loads the child collection with its props", async () => {
    render(
      <LazyResourceChildCollection
        urlKey="sequences"
        resource="genome_sequence"
        label="Sequences"
        idField="sequence_id"
        rql="eq(genome_id,*)"
        defaultSort="sequence_id:asc"
      />,
    );

    const collection = await screen.findByTestId("child-collection");
    expect(collection).toHaveTextContent("eq(genome_id,*)");
    expect(collection).toHaveAttribute("data-url-key", "sequences");
    expect(collection).toHaveAttribute("data-resource", "genome_sequence");
  });

  it("loads the interactions shell with its props", async () => {
    render(
      <LazyInteractionsSubviewShell rql="eq(evidence,experimental)" guideUrl="/guide" />,
    );

    const shell = await screen.findByTestId("interactions-shell");
    expect(shell).toHaveTextContent("eq(evidence,experimental)");
    expect(shell).toHaveAttribute("data-guide", "/guide");
  });

  it.each([
    ["bacterial", LazyBacterialPhylogenyPanel, "bacterial-panel"],
    ["viral", LazyViralPhylogenyPanel, "viral-panel"],
  ])("loads the %s phylogeny panel with its props", async (_label, Lazy, testId) => {
    render(<Lazy taxonId={1280} taxonName="Staphylococcus aureus" />);

    const panel = await screen.findByTestId(testId);
    expect(panel).toHaveTextContent("Staphylococcus aureus");
    expect(panel).toHaveAttribute("data-taxon-id", "1280");
  });

  it("loads the taxonomy tree with its props", async () => {
    render(
      <LazyTaxonomyTreePanel
        taxa={[
          {
            taxonId: 10239,
            taxonName: "Viruses",
            lineageIds: [10239],
            lineageNames: ["Viruses"],
            taxonRank: "superkingdom",
            genomes: null,
          },
        ]}
        phylogenyTaxonIds={[10239]}
      />,
    );

    const tree = await screen.findByTestId("taxonomy-tree");
    expect(tree).toHaveTextContent("Viruses");
    expect(tree).toHaveAttribute("data-phylogeny-ids", "10239");
  });
});
