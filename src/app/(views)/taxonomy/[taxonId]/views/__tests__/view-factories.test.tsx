import { fireEvent, render, screen } from "@testing-library/react";
import type { OrganismTaxonomy } from "@/lib/services/organisms/types";
import { makeStrainsView } from "@/components/organisms/taxon-views/strains";
import { makeSerologyView } from "@/components/organisms/taxon-views/serology";
import { makeSurveillanceView } from "@/components/organisms/taxon-views/surveillance";
import { makeGenomesView } from "@/components/organisms/taxon-views/genomes";
import { makeSequencesView } from "@/components/organisms/taxon-views/sequences";
import { makeProteinStructuresView } from "@/components/organisms/taxon-views/protein-structures";
import { makeDomainsAndMotifsView } from "@/components/organisms/taxon-views/domains-and-motifs";
import { makeFeaturesView } from "@/components/organisms/taxon-views/features";
import { makeEpitopesView } from "@/components/organisms/taxon-views/epitopes";
import { makeExperimentsView } from "@/components/organisms/taxon-views/experiments";
import { makeInteractionsView } from "@/components/organisms/taxon-views/interactions";
import { makeSfvtView } from "@/components/organisms/taxon-views/sfvt";

// TaxonDataPanel has complex network + React dependencies; mock it so tests stay
// focused on the factory guard logic (null taxon → render nothing).
vi.mock("@/components/organisms/taxon-views/taxon-data-panel", () => ({
  TaxonDataPanel: ({
    resource,
    q,
    guideUrl,
    keywordMode,
  }: {
    resource: string;
    q: string;
    guideUrl?: string;
    keywordMode?: "server" | "loaded";
  }) => (
    <div
      data-testid="taxon-data-panel"
      data-resource={resource}
      data-q={q}
      data-guide={guideUrl}
      data-keyword-mode={keywordMode}
    />
  ),
}));

interface FeatureResourceCollectionProps {
  baseRql: string;
  enableRowLinks: boolean;
  keywordMode?: "server" | "loaded";
}

function FeatureResourceCollection({
  baseRql,
  enableRowLinks,
  keywordMode,
}: FeatureResourceCollectionProps) {
  return (
    <div
      data-testid="feature-resource-collection"
      data-q={baseRql}
      data-row-links={String(enableRowLinks)}
      data-keyword-mode={keywordMode ?? "loaded"}
    />
  );
}

vi.mock("@/components/views", () => ({
  ResourceChildCollection: ({
    resource,
    rql,
  }: {
    resource: string;
    rql: string;
  }) => (
    <div
      data-testid="resource-child-collection"
      data-resource={resource}
      data-q={rql}
    />
  ),
  ExperimentResourceCollection: ({
    baseRql,
    enableRowLinks,
    keywordMode,
  }: {
    baseRql: string;
    enableRowLinks: boolean;
    keywordMode?: "server" | "loaded";
  }) => (
    <div
      data-testid="experiment-resource-collection"
      data-q={baseRql}
      data-row-links={String(enableRowLinks)}
      data-keyword-mode={keywordMode ?? "loaded"}
    />
  ),
  EpitopeResourceCollection: ({
    baseRql,
    enableRowLinks,
    keywordMode,
  }: {
    baseRql: string;
    enableRowLinks: boolean;
    keywordMode?: "server" | "loaded";
  }) => (
    <div
      data-testid="epitope-resource-collection"
      data-q={baseRql}
      data-row-links={String(enableRowLinks)}
      data-keyword-mode={keywordMode ?? "loaded"}
    />
  ),
  SurveillanceResourceCollection: function SurveillanceResourceCollection({
    baseRql,
    enableRowLinks,
    keywordMode,
  }: {
    baseRql: string;
    enableRowLinks: boolean;
    keywordMode?: "server" | "loaded";
  }) {
    return (
      <div
        data-testid="surveillance-resource-collection"
        data-q={baseRql}
        data-row-links={String(enableRowLinks)}
        data-keyword-mode={keywordMode ?? "loaded"}
      />
    );
  },
  SerologyResourceCollection: function SerologyResourceCollection({
    baseRql,
    enableRowLinks,
    keywordMode,
  }: {
    baseRql: string;
    enableRowLinks: boolean;
    keywordMode?: "server" | "loaded";
  }) {
    return (
      <div
        data-testid="serology-resource-collection"
        data-q={baseRql}
        data-row-links={String(enableRowLinks)}
        data-keyword-mode={keywordMode ?? "loaded"}
      />
    );
  },
  StrainResourceCollection: function StrainResourceCollection({
    baseRql,
    enableRowLinks,
    keywordMode,
  }: {
    baseRql: string;
    enableRowLinks: boolean;
    keywordMode?: "server" | "loaded";
  }) {
    return (
      <div
        data-testid="strain-resource-collection"
        data-q={baseRql}
        data-row-links={String(enableRowLinks)}
        data-keyword-mode={keywordMode ?? "loaded"}
      />
    );
  },
  ProteinStructureResourceCollection:
    function ProteinStructureResourceCollection({
      baseRql,
      keywordMode,
    }: {
      baseRql: string;
      keywordMode?: "server" | "loaded";
    }) {
      return (
        <div
          data-testid="protein-structure-resource-collection"
          data-q={baseRql}
          data-keyword-mode={keywordMode ?? "loaded"}
        />
      );
    },
  ProteinFeatureResourceCollection: function ProteinFeatureResourceCollection({
    baseRql,
    enableRowLinks,
    keywordMode,
  }: {
    baseRql: string;
    enableRowLinks: boolean;
    keywordMode?: "server" | "loaded";
  }) {
    return (
      <div
        data-testid="protein-feature-resource-collection"
        data-q={baseRql}
        data-row-links={String(enableRowLinks)}
        data-keyword-mode={keywordMode ?? "loaded"}
      />
    );
  },
  FeatureResourceCollection,
  GenomeResourceCollection: ({
    baseRql,
    enableRowLinks,
    keywordMode,
  }: {
    baseRql: string;
    enableRowLinks: boolean;
    keywordMode?: "server" | "loaded";
  }) => (
    <div
      data-testid="genome-resource-collection"
      data-q={baseRql}
      data-row-links={String(enableRowLinks)}
      data-keyword-mode={keywordMode ?? "loaded"}
    />
  ),
}));

const fakeTaxon: OrganismTaxonomy = {
  taxonId: 1234,
  taxonName: "Test Virus",
  lineageIds: [1234, 10239],
  lineageNames: ["Test Virus", "Viruses"],
  taxonRank: "species",
  genomes: null,
};
const scope = { kind: "lineage" as const, taxon: fakeTaxon };
const compositeScope = {
  kind: "composite" as const,
  displayName: "All Organisms",
  roots: [
    { ...fakeTaxon, taxonId: 131567, taxonName: "cellular organisms" },
    { ...fakeTaxon, taxonId: 10239, taxonName: "Viruses" },
  ],
};
const compositeClause =
  "or(eq(taxon_lineage_ids,131567),eq(taxon_lineage_ids,10239))";

describe("makeStrainsView", () => {
  it("renders the shared Strain collection with taxon scope", () => {
    const StrainsView = makeStrainsView({ scope });
    render(<StrainsView />);
    const panel = screen.getByTestId("strain-resource-collection");
    expect(panel).toHaveAttribute("data-q", "eq(taxon_lineage_ids,1234)");
    expect(panel).toHaveAttribute("data-row-links", "false");
    expect(panel).toHaveAttribute("data-keyword-mode", "loaded");
  });
});

describe("makeSerologyView", () => {
  it("renders the shared Serology collection with taxon scope", () => {
    const SerologyView = makeSerologyView({ scope });
    render(<SerologyView />);
    const panel = screen.getByTestId("serology-resource-collection");
    expect(panel).toHaveAttribute("data-q", "eq(taxon_lineage_ids,1234)");
    expect(panel).toHaveAttribute("data-row-links", "false");
    expect(panel).toHaveAttribute("data-keyword-mode", "loaded");
  });
});

describe("makeGenomesView", () => {
  it("renders the shared Genome collection with taxon scope", () => {
    const GenomesView = makeGenomesView({ scope });
    const { getByTestId } = render(<GenomesView />);
    const collection = getByTestId("genome-resource-collection");
    expect(collection).toHaveAttribute("data-q", "eq(taxon_lineage_ids,1234)");
    expect(collection).toHaveAttribute("data-row-links", "false");
    expect(collection).toHaveAttribute("data-keyword-mode", "loaded");
  });
});

describe("makeSequencesView", () => {
  it("renders TaxonDataPanel with the genome_sequence cross-core join query", () => {
    // The query shape is the key discovery: genome_sequence has no
    // taxon_lineage_ids field, so it must join to the genome core. Assert the
    // join fragments — a test that only checked for "1234" would pass the
    // known-bad eq(taxon_lineage_ids,1234) applied directly to genome_sequence.
    const SequencesView = makeSequencesView({ scope });
    const { getByTestId } = render(<SequencesView />);
    const panel = getByTestId("taxon-data-panel");
    expect(panel).toHaveAttribute("data-resource", "genome_sequence");
    const q = panel.getAttribute("data-q") ?? "";
    expect(q).toContain("eq(genome_id,*)");
    expect(q).toContain(
      "genome(and(eq(taxon_lineage_ids,1234),ne(genome_status,Deprecated)))",
    );
  });

  it("passes the sequences guide URL", () => {
    const SequencesView = makeSequencesView({ scope });
    const { getByTestId } = render(<SequencesView />);
    expect(
      getByTestId("taxon-data-panel").getAttribute("data-guide"),
    ).toContain("sequences.html");
  });
});

describe("makeProteinStructuresView", () => {
  it("renders TaxonDataPanel with the protein_structure cross-core join query", () => {
    const ProteinStructuresView = makeProteinStructuresView({ scope });
    const { getByTestId } = render(<ProteinStructuresView />);
    const panel = getByTestId("protein-structure-resource-collection");
    const q = panel.getAttribute("data-q") ?? "";
    expect(q).toContain("eq(genome_id,*)");
    expect(q).toContain(
      "genome(and(eq(taxon_lineage_ids,1234),ne(genome_status,Deprecated)))",
    );
  });

});

describe("makeDomainsAndMotifsView", () => {
  it("renders the shared collection with the exact cross-core scope", () => {
    const DomainsAndMotifsView = makeDomainsAndMotifsView({ scope });
    const { getByTestId } = render(<DomainsAndMotifsView />);
    const collection = getByTestId("protein-feature-resource-collection");
    expect(collection).toHaveAttribute(
      "data-q",
      "and(eq(genome_id,*),genome(eq(taxon_lineage_ids,1234)))",
    );
    expect(collection.getAttribute("data-q")).not.toContain("Deprecated");
    expect(collection).toHaveAttribute("data-row-links", "false");
    expect(collection).toHaveAttribute("data-keyword-mode", "loaded");
  });
});

describe("makeFeaturesView", () => {
  it("renders the shared Feature collection with the descendant-taxon query", () => {
    const FeaturesView = makeFeaturesView({ scope });
    render(<FeaturesView />);
    const panel = screen.getByTestId("feature-resource-collection");
    expect(panel).toHaveAttribute(
      "data-q",
      "and(eq(genome_id,*),genome(and(eq(taxon_lineage_ids,1234),ne(genome_status,Deprecated))),eq(annotation,PATRIC))",
    );
    expect(panel).toHaveAttribute("data-row-links", "false");
    expect(panel).toHaveAttribute("data-keyword-mode", "loaded");
  });
});

describe("makeEpitopesView", () => {
  it("renders the shared Epitope collection with taxon scope", () => {
    const EpitopesView = makeEpitopesView({ scope });
    const { getByTestId } = render(<EpitopesView />);
    const panel = getByTestId("epitope-resource-collection");
    expect(panel.getAttribute("data-q")).toContain("1234");
    expect(panel).toHaveAttribute("data-row-links", "false");
    expect(panel).toHaveAttribute("data-keyword-mode", "loaded");
  });
});

describe("makeSurveillanceView", () => {
  it("renders the shared Surveillance collection with taxon scope", () => {
    const SurveillanceView = makeSurveillanceView({ scope });
    render(<SurveillanceView />);
    const panel = screen.getByTestId("surveillance-resource-collection");
    expect(panel).toHaveAttribute("data-q", "eq(taxon_lineage_ids,1234)");
    expect(panel).toHaveAttribute("data-row-links", "false");
    expect(panel).toHaveAttribute("data-keyword-mode", "loaded");
  });
});

describe("makeExperimentsView", () => {
  it("renders the shared Experiment collection with taxon scope", () => {
    const ExperimentsView = makeExperimentsView({ scope });
    render(<ExperimentsView />);
    const panel = screen.getByTestId("experiment-resource-collection");
    expect(panel).toHaveAttribute("data-q", "eq(taxon_lineage_ids,1234)");
    expect(panel).toHaveAttribute("data-row-links", "false");
    expect(panel).toHaveAttribute("data-keyword-mode", "loaded");
  });

  it("preserves the Biosets tab with taxon scope", () => {
    const ExperimentsView = makeExperimentsView({ scope });
    render(<ExperimentsView />);

    fireEvent.click(screen.getByRole("tab", { name: "Biosets" }));

    const panel = screen.getByTestId("resource-child-collection");
    expect(panel).toHaveAttribute("data-resource", "bioset");
    expect(panel).toHaveAttribute(
      "data-q",
      "and(eq(genome_id,*),genome(eq(taxon_lineage_ids,1234)))",
    );
  });
});

describe("composite scope queries", () => {
  it.each([
    ["genome", makeGenomesView, compositeClause],
    [
      "genome_sequence",
      makeSequencesView,
      `and(eq(genome_id,*),genome(and(${compositeClause},ne(genome_status,Deprecated))))`,
    ],
    [
      "protein_structure",
      makeProteinStructuresView,
      `and(eq(genome_id,*),genome(and(${compositeClause},ne(genome_status,Deprecated))))`,
    ],
    [
      "protein_feature",
      makeDomainsAndMotifsView,
      `and(eq(genome_id,*),genome(${compositeClause}))`,
    ],
    [
      "genome_feature",
      makeFeaturesView,
      `and(eq(genome_id,*),genome(and(${compositeClause},ne(genome_status,Deprecated))),eq(annotation,PATRIC))`,
    ],
    ["strain", makeStrainsView, compositeClause],
    ["surveillance", makeSurveillanceView, compositeClause],
    ["serology", makeSerologyView, compositeClause],
    ["epitope", makeEpitopesView, compositeClause],
  ])("builds the exact %s query", (resource, makeView, expectedQuery) => {
    const View = makeView({ scope: compositeScope });
    render(<View />);

    if (
      resource === "genome" ||
      resource === "genome_feature" ||
      resource === "epitope" ||
      resource === "protein_feature" ||
      resource === "protein_structure" ||
      resource === "strain" ||
      resource === "surveillance" ||
      resource === "serology"
    ) {
      const testId =
        resource === "genome_feature"
          ? "feature-resource-collection"
          : resource === "protein_feature"
          ? "protein-feature-resource-collection"
          : resource === "protein_structure"
            ? "protein-structure-resource-collection"
            : `${resource}-resource-collection`;
      expect(screen.getByTestId(testId)).toHaveAttribute(
        "data-q",
        expectedQuery,
      );
      return;
    }
    expect(screen.getByTestId("taxon-data-panel")).toHaveAttribute(
      "data-resource",
      resource,
    );
    expect(screen.getByTestId("taxon-data-panel")).toHaveAttribute(
      "data-q",
      expectedQuery,
    );
  });

  it("queries every curated SFVT cohort for a composite containing the Viruses root", () => {
    const View = makeSfvtView({
      scope: compositeScope,
      sfvtTaxonIds: new Set([12637, 2955291]),
    });
    render(<View />);

    expect(screen.getByTestId("taxon-data-panel")).toHaveAttribute(
      "data-q",
      "in(taxon_id,(12637,11320))",
    );
  });

  it("queries only SFVT cohorts represented by composite roots", () => {
    const scope = {
      kind: "composite" as const,
      displayName: "Fungi and Influenza",
      roots: [
        { ...fakeTaxon, taxonId: 4751, lineageIds: [2759, 4751] },
        { ...fakeTaxon, taxonId: 2955291, lineageIds: [10239, 11308, 2955291] },
      ],
    };
    const View = makeSfvtView({
      scope,
      sfvtTaxonIds: new Set([12637, 2955291]),
    });
    render(<View />);

    expect(screen.getByTestId("taxon-data-panel")).toHaveAttribute(
      "data-q",
      "eq(taxon_id,11320)",
    );
  });

  it("excludes remapped cohorts removed from the curated set", () => {
    const scope = {
      kind: "composite" as const,
      displayName: "Dengue and Influenza",
      roots: [
        { ...fakeTaxon, taxonId: 12637, lineageIds: [10239, 12637] },
        { ...fakeTaxon, taxonId: 2955291, lineageIds: [10239, 11308, 2955291] },
      ],
    };
    const View = makeSfvtView({ scope, sfvtTaxonIds: new Set([12637]) });
    render(<View />);

    expect(screen.getByTestId("taxon-data-panel")).toHaveAttribute(
      "data-q",
      "eq(taxon_id,12637)",
    );
  });

  it("applies the composite clause to experiments", () => {
    const View = makeExperimentsView({ scope: compositeScope });
    render(<View />);
    expect(screen.getByTestId("experiment-resource-collection")).toHaveAttribute(
      "data-q",
      compositeClause,
    );
  });
});

describe("makeInteractionsView", () => {
  it("renders TaxonDataPanel with the ppi cross-core join query", () => {
    const InteractionsView = makeInteractionsView({ scope });
    const { getByTestId } = render(<InteractionsView />);
    const panel = getByTestId("taxon-data-panel");
    expect(panel).toHaveAttribute("data-resource", "ppi");
    const q = panel.getAttribute("data-q") ?? "";
    expect(q).toContain("eq(genome_id_a,*)");
    expect(q).toContain(
      "genome(to(genome_id_a),and(eq(taxon_lineage_ids,1234),ne(genome_status,Deprecated)))",
    );
    expect(q).toContain("eq(evidence,experimental)");
  });

  it("passes the interactions guide URL", () => {
    const InteractionsView = makeInteractionsView({ scope });
    const { getByTestId } = render(<InteractionsView />);
    expect(getByTestId("taxon-data-panel").getAttribute("data-guide")).toBe(
      "https://www.bv-brc.org/docs/quick_references/organisms_taxon/interactions.html",
    );
  });
});
