import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { GraphDetailPanel } from "../graph-detail-panel";
import type { GEdge, GNode, GraphSelection } from "@/lib/interactions/types";

const nodeA: GNode = {
  id: "fig|1.1",
  gene: "dnaA",
  genome: "Ehrlichia canis",
  refseqLocusTag: "Ecaj_0270",
  interactorDesc: "Chromosomal replication initiator protein DnaA",
  kind: "microbial",
};
const nodeB: GNode = { id: "fig|2.2", gene: "ftsA", kind: "host" };

const edge: GEdge = {
  id: "e1",
  source: "fig|1.1",
  target: "fig|2.2",
  evidence: "experimental",
  interactionType: "predicted interaction",
  detectionMethod: "predictive text mining",
  experimental: false,
};

const nodesById = new Map<string, GNode>([
  [nodeA.id, nodeA],
  [nodeB.id, nodeB],
]);

const empty: GraphSelection = { nodes: [], edges: [] };

function renderPanel(overrides: Partial<Parameters<typeof GraphDetailPanel>[0]> = {}) {
  return render(
    <GraphDetailPanel
      selection={empty}
      incidentEdges={[]}
      nodesById={nodesById}
      onSelectEdge={vi.fn()}
      {...overrides}
    />,
  );
}

describe("GraphDetailPanel", () => {
  it("prompts to select when nothing is selected", () => {
    renderPanel();
    expect(screen.getByText("Select a node or edge to see details.")).toBeInTheDocument();
  });

  it("summarizes bulk selections instead of rendering thousands of detail records", () => {
    renderPanel({ selection: { nodes: [nodeA, nodeB], edges: [edge] } });
    expect(screen.getByText("Bulk selection")).toBeInTheDocument();
    expect(screen.getByText("2 proteins and 1 interactions selected.")).toBeInTheDocument();
  });

  describe("node selected", () => {
    it("renders every node field with its value", () => {
      renderPanel({ selection: { nodes: [nodeA], edges: [] } });

      for (const label of ["BRC ID", "Genome", "Locus tag", "Gene", "Product"]) {
        expect(screen.getByText(label)).toBeInTheDocument();
      }
      expect(screen.getByText(nodeA.id)).toBeInTheDocument();
      expect(screen.getByText("Ehrlichia canis")).toBeInTheDocument();
      expect(screen.getByText("Ecaj_0270")).toBeInTheDocument();
      expect(screen.getByText("dnaA")).toBeInTheDocument();
      expect(screen.getByText("Chromosomal replication initiator protein DnaA")).toBeInTheDocument();
    });

    it("shows an em-dash for each missing optional field", () => {
      const bare: GNode = { id: "fig|3.3", kind: "microbial" };
      renderPanel({ selection: { nodes: [bare], edges: [] } });

      expect(screen.getByText(bare.id)).toBeInTheDocument();
      expect(screen.getAllByText("—")).toHaveLength(4);
    });

    it("flips label to foreground and value to muted-foreground", () => {
      renderPanel({ selection: { nodes: [nodeA], edges: [] } });

      expect(screen.getByText("BRC ID")).toHaveClass("text-foreground");
      expect(screen.getByText(nodeA.id)).toHaveClass("text-muted-foreground");
    });

    it("lists incident edges under an Interactions (N) header and resolves endpoint labels", () => {
      renderPanel({ selection: { nodes: [nodeA], edges: [] }, incidentEdges: [edge] });

      expect(screen.getByText("Interactions (1)")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "ftsA · predicted interaction" }),
      ).toBeInTheDocument();
    });

    it("invokes onSelectEdge with the clicked incident edge", async () => {
      const user = userEvent.setup();
      const onSelectEdge = vi.fn();
      renderPanel({ selection: { nodes: [nodeA], edges: [] }, incidentEdges: [edge], onSelectEdge });

      await user.click(screen.getByRole("button", { name: /ftsA/ }));
      expect(onSelectEdge).toHaveBeenCalledWith(edge);
    });

    it("omits the interactionType suffix when the edge has none", () => {
      const bare: GEdge = { ...edge, interactionType: "" };
      renderPanel({ selection: { nodes: [nodeA], edges: [] }, incidentEdges: [bare] });

      expect(screen.getByRole("button", { name: "ftsA" })).toBeInTheDocument();
    });

    it("falls back to the raw id when the endpoint node is not in nodesById", () => {
      const orphan: GEdge = { ...edge, target: "fig|9.9" };
      renderPanel({ selection: { nodes: [nodeA], edges: [] }, incidentEdges: [orphan] });

      expect(
        screen.getByRole("button", { name: "fig|9.9 · predicted interaction" }),
      ).toBeInTheDocument();
    });

    it("hides the Interactions section when a node has no incident edges", () => {
      renderPanel({ selection: { nodes: [nodeA], edges: [] }, incidentEdges: [] });
      expect(screen.queryByText(/^Interactions \(/)).not.toBeInTheDocument();
    });
  });

  describe("edge selected", () => {
    it("renders the Interaction header and every edge field", () => {
      renderPanel({ selection: { nodes: [], edges: [edge] } });

      expect(screen.getByText("Interaction")).toBeInTheDocument();
      expect(screen.getByText("From")).toBeInTheDocument();
      expect(screen.getByText("dnaA")).toBeInTheDocument();
      expect(screen.getByText("To")).toBeInTheDocument();
      expect(screen.getByText("ftsA")).toBeInTheDocument();
      expect(screen.getByText("predicted interaction")).toBeInTheDocument();
      expect(screen.getByText("predictive text mining")).toBeInTheDocument();
      expect(screen.getByText("experimental")).toBeInTheDocument();
    });

    it("shows em-dashes for blank type/method/evidence", () => {
      const blank: GEdge = { ...edge, interactionType: "", detectionMethod: "", evidence: "" };
      renderPanel({ selection: { nodes: [], edges: [blank] } });

      expect(screen.getAllByText("—")).toHaveLength(3);
    });

    it("flips edge labels to foreground and values to muted-foreground", () => {
      renderPanel({ selection: { nodes: [], edges: [edge] } });

      expect(screen.getByText("Interaction")).toHaveClass("text-foreground");
      expect(screen.getByText("From")).toHaveClass("text-foreground");
      expect(screen.getByText("predicted interaction")).toHaveClass("text-muted-foreground");
    });
  });
});
