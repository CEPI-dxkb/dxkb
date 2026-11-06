import { render } from "@testing-library/react";

import type { OrganismTaxonomy } from "@/lib/services/organisms/types";

import { makePhylogenyView } from "@/components/organisms/taxon-views/phylogeny";

// Both panels pull in Archaeopteryx/Auspice and live network state, and the
// factory reaches them through lazy-tab-roots. Stub its wrappers so these tests
// stay on the factory: lineage routing and the shared frame.
vi.mock("@/components/organisms/taxon-views/lazy-tab-roots", () => ({
  LazyViralPhylogenyPanel: ({ taxonId, taxonName }: { taxonId: number; taxonName: string }) => (
    <div data-testid="viral-panel" data-taxon-id={taxonId} data-taxon-name={taxonName} />
  ),
  LazyBacterialPhylogenyPanel: ({ taxonId, taxonName }: { taxonId: number; taxonName: string }) => (
    <div data-testid="bacterial-panel" data-taxon-id={taxonId} data-taxon-name={taxonName} />
  ),
}));

const viralTaxon: OrganismTaxonomy = {
  taxonId: 2955291,
  taxonName: "Alphainfluenzavirus influenzae",
  lineageIds: [10239, 2955291],
  lineageNames: ["Viruses", "Alphainfluenzavirus influenzae"],
  taxonRank: "species",
  genomes: null,
};

const bacterialTaxon: OrganismTaxonomy = {
  taxonId: 1280,
  taxonName: "Staphylococcus aureus",
  lineageIds: [2, 1280],
  lineageNames: ["Bacteria", "Staphylococcus aureus"],
  taxonRank: "species",
  genomes: null,
};

function renderView(taxon: OrganismTaxonomy | null) {
  const PhylogenyView = makePhylogenyView({ taxon });
  return render(<PhylogenyView />);
}

describe("makePhylogenyView", () => {
  it("renders nothing when taxon is null", () => {
    const { container } = renderView(null);
    expect(container.firstChild).toBeNull();
  });

  it("routes bacterial lineages to the bacterial panel", () => {
    const { getByTestId, queryByTestId } = renderView(bacterialTaxon);
    expect(getByTestId("bacterial-panel")).toHaveAttribute("data-taxon-id", "1280");
    expect(queryByTestId("viral-panel")).toBeNull();
  });

  it("routes non-bacterial lineages to the viral panel", () => {
    const { getByTestId, queryByTestId } = renderView(viralTaxon);
    expect(getByTestId("viral-panel")).toHaveAttribute("data-taxon-id", "2955291");
    expect(queryByTestId("bacterial-panel")).toBeNull();
  });

  // The frame lives on the factory, not the panels, so every phylogeny state
  // (tree picker, Archaeopteryx, Auspice iframe, error, empty) is boxed the same.
  // Moving it back down to a viewer regresses the states that viewer doesn't own.
  it.each([
    ["viral", viralTaxon, "viral-panel"],
    ["bacterial", bacterialTaxon, "bacterial-panel"],
  ])("wraps the %s panel in a bordered, top-left-rounded frame", (_label, taxon, panelId) => {
    const { container, getByTestId } = renderView(taxon);
    const frame = container.firstElementChild;
    expect(frame).toHaveClass("border", "rounded-tl-lg", "overflow-hidden");
    expect(frame).toContainElement(getByTestId(panelId));
  });
});
