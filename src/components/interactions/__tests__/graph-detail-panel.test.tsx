import { render, screen, within } from "@testing-library/react";
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
const linkedA: GNode = {
  id: "fig|224914.16.peg.1",
  featureId: "PATRIC.224914.16.CDS.1",
  genomeId: "224914.16",
  genome: "Brucella melitensis",
  gene: "hisD",
  kind: "microbial",
};
const linkedB: GNode = {
  id: "fig|224914.16.peg.2",
  featureId: "PATRIC.224914.16.CDS.2",
  genomeId: "224914.16",
  genome: "Brucella melitensis",
  gene: "metH",
  kind: "microbial",
};
const hostNode: GNode = {
  id: "P12345",
  featureId: "stray-feature",
  genomeId: "9606.1",
  genome: "Homo sapiens",
  gene: "TP53",
  kind: "host",
};

const edge: GEdge = {
  id: "e1",
  source: "fig|1.1",
  target: "fig|2.2",
  evidence: "experimental",
  interactionType: "predicted interaction",
  detectionMethod: "predictive text mining",
  experimental: false,
};

const linkedEdge: GEdge = { ...edge, id: "e2", source: linkedA.id, target: linkedB.id };

const nodesById = new Map<string, GNode>([
  [nodeA.id, nodeA],
  [nodeB.id, nodeB],
]);
const linkedNodesById = new Map<string, GNode>([
  [linkedA.id, linkedA],
  [linkedB.id, linkedB],
  [hostNode.id, hostNode],
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

  describe("focus on a protein", () => {
    const focusButton = () =>
      screen.queryByRole("button", { name: "Focus on this protein" });

    it("offers the button for a single selected node when a handler is given", async () => {
      const user = userEvent.setup();
      const onFocusNode = vi.fn();
      renderPanel({ selection: { nodes: [nodeA], edges: [] }, onFocusNode });

      await user.click(screen.getByRole("button", { name: "Focus on this protein" }));

      expect(onFocusNode).toHaveBeenCalledTimes(1);
      expect(onFocusNode).toHaveBeenCalledWith(nodeA);
      expect(onFocusNode.mock.calls[0][0]).toHaveProperty("id", "fig|1.1");
    });

    describe("what it does and how to undo it", () => {
      const hint =
        "Shows only this protein's interactions; remove the Protein filter in the Filters menu to undo.";
      const infoButton = () =>
        screen.queryByRole("button", { name: "About focusing" });

      it("keeps the explanation out of the panel until the info button is opened", () => {
        renderPanel({
          selection: { nodes: [nodeA], edges: [] },
          onFocusNode: vi.fn(),
        });

        expect(screen.queryByText(hint)).not.toBeInTheDocument();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(infoButton()).toBeInTheDocument();
      });

      it("opens the explanation from the info button", async () => {
        const user = userEvent.setup();
        renderPanel({
          selection: { nodes: [nodeA], edges: [] },
          onFocusNode: vi.fn(),
        });

        await user.click(screen.getByRole("button", { name: "About focusing" }));

        expect(await screen.findByText(hint)).toBeVisible();
      });

      it("names the opened dialog, with the explanation inside it", async () => {
        const user = userEvent.setup();
        renderPanel({
          selection: { nodes: [nodeA], edges: [] },
          onFocusNode: vi.fn(),
        });

        await user.click(screen.getByRole("button", { name: "About focusing" }));

        const dialog = await screen.findByRole("dialog", {
          name: "Focusing on a protein",
        });
        expect(dialog).toHaveTextContent(hint);
        expect(dialog).toBeVisible();
      });

      it("keeps the dialog's title from matching the Focus button's name", async () => {
        const user = userEvent.setup();
        renderPanel({
          selection: { nodes: [nodeA], edges: [] },
          onFocusNode: vi.fn(),
        });

        await user.click(screen.getByRole("button", { name: "About focusing" }));
        await screen.findByRole("dialog", { name: "Focusing on a protein" });

        expect(
          screen.getAllByRole("button", { name: /Focus on this protein/ }),
        ).toHaveLength(1);
        expect(
          screen.queryByRole("dialog", { name: /Focus on this protein/ }),
        ).not.toBeInTheDocument();
      });

      it("opens from the keyboard, with the info button right after the Focus button", async () => {
        const user = userEvent.setup();
        renderPanel({
          selection: { nodes: [nodeA], edges: [] },
          onFocusNode: vi.fn(),
        });

        screen.getByRole("button", { name: "Focus on this protein" }).focus();
        await user.tab();
        expect(infoButton()).toHaveFocus();

        await user.keyboard("{Enter}");
        expect(await screen.findByText(hint)).toBeVisible();
      });

      it("does not run the focus when the info button is used", async () => {
        const user = userEvent.setup();
        const onFocusNode = vi.fn();
        renderPanel({
          selection: { nodes: [nodeA], edges: [] },
          onFocusNode,
        });

        await user.click(screen.getByRole("button", { name: "About focusing" }));
        await screen.findByText(hint);

        expect(onFocusNode).not.toHaveBeenCalled();
      });

      it("names the info button so it never matches the Focus button's name", () => {
        renderPanel({
          selection: { nodes: [nodeA], edges: [] },
          onFocusNode: vi.fn(),
        });

        expect(
          screen.getAllByRole("button", { name: /Focus on this protein/ }),
        ).toHaveLength(1);
        expect(
          screen.getByRole("button", { name: "Focus on this protein" }),
        ).not.toBe(screen.getByRole("button", { name: "About focusing" }));
      });
    });

    it("is absent without a handler, so the panel renders as before", () => {
      renderPanel({ selection: { nodes: [nodeA], edges: [] } });

      expect(focusButton()).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "About focusing" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/remove the Protein filter/)).not.toBeInTheDocument();
    });

    it("is absent for a bulk selection and for an edge", () => {
      const { unmount } = renderPanel({
        selection: { nodes: [nodeA, nodeB], edges: [] },
        onFocusNode: vi.fn(),
      });
      expect(focusButton()).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "About focusing" }),
      ).not.toBeInTheDocument();
      unmount();

      renderPanel({ selection: { nodes: [], edges: [edge] }, onFocusNode: vi.fn() });
      expect(focusButton()).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "About focusing" }),
      ).not.toBeInTheDocument();
    });

    it("keeps the em-dash count for a bare node", () => {
      const bare: GNode = { id: "fig|3.3", kind: "microbial" };
      renderPanel({
        selection: { nodes: [bare], edges: [] },
        onFocusNode: vi.fn(),
      });

      expect(screen.getAllByText("—")).toHaveLength(4);
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

  describe("links", () => {
    it("links a selected node's BRC ID and gene to its feature and its genome to the genome page", () => {
      renderPanel({
        selection: { nodes: [linkedA], edges: [] },
        nodesById: linkedNodesById,
      });

      expect(screen.getByRole("link", { name: linkedA.id })).toHaveAttribute(
        "href",
        "/feature/PATRIC.224914.16.CDS.1",
      );
      expect(screen.getByRole("link", { name: "hisD" })).toHaveAttribute(
        "href",
        "/feature/PATRIC.224914.16.CDS.1",
      );
      expect(
        screen.getByRole("link", { name: "Brucella melitensis" }),
      ).toHaveAttribute("href", "/genome/224914.16");
    });

    it("renders plain text when the node has no feature or genome id", () => {
      renderPanel({ selection: { nodes: [nodeA], edges: [] } });
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    it("never links a host node, even when ids are present", () => {
      renderPanel({
        selection: { nodes: [hostNode], edges: [] },
        nodesById: linkedNodesById,
      });

      expect(screen.getByText("Homo sapiens")).toBeInTheDocument();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    it("does not link a genome whose id is not a genome id", () => {
      const odd: GNode = { ...linkedA, genomeId: "not-a-genome-id" };
      renderPanel({ selection: { nodes: [odd], edges: [] } });

      expect(screen.getByText("Brucella melitensis")).toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "Brucella melitensis" }),
      ).not.toBeInTheDocument();
    });

    it("shows the genome id as the linked label when the name is missing", () => {
      const unnamed: GNode = { ...linkedA, genome: undefined };
      renderPanel({ selection: { nodes: [unnamed], edges: [] } });

      expect(screen.getByRole("link", { name: "224914.16" })).toHaveAttribute(
        "href",
        "/genome/224914.16",
      );
    });

    it("links both endpoints of a selected edge to their feature pages", () => {
      renderPanel({
        selection: { nodes: [], edges: [linkedEdge] },
        nodesById: linkedNodesById,
      });

      expect(screen.getByRole("link", { name: "hisD" })).toHaveAttribute(
        "href",
        "/feature/PATRIC.224914.16.CDS.1",
      );
      expect(screen.getByRole("link", { name: "metH" })).toHaveAttribute(
        "href",
        "/feature/PATRIC.224914.16.CDS.2",
      );
    });

    it("leaves an edge endpoint missing from nodesById as plain text", () => {
      const orphan: GEdge = { ...linkedEdge, target: "fig|9.9" };
      renderPanel({
        selection: { nodes: [], edges: [orphan] },
        nodesById: linkedNodesById,
      });

      expect(screen.getByText("fig|9.9")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "fig|9.9" })).not.toBeInTheDocument();
    });

    it("keeps incident-edge rows as buttons, not links", () => {
      renderPanel({
        selection: { nodes: [linkedA], edges: [] },
        nodesById: linkedNodesById,
        incidentEdges: [linkedEdge],
      });

      const incidentButton = screen.getByRole("button", { name: /metH/ });
      expect(incidentButton).toBeInTheDocument();
      expect(within(incidentButton).queryByRole("link")).toBeNull();
      expect(screen.queryByRole("link", { name: /predicted interaction/ })).not.toBeInTheDocument();
    });
  });
});
