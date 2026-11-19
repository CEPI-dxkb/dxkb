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
const incident = (edges: GEdge[]) => new Map([[nodeA.id, edges]]);

function renderPanel(overrides: Partial<Parameters<typeof GraphDetailPanel>[0]> = {}) {
  return render(
    <GraphDetailPanel
      selection={empty}
      incidentEdgesByNode={new Map()}
      nodesById={nodesById}
      onSelectEdge={vi.fn()}
      onSelectNode={vi.fn()}
      {...overrides}
    />,
  );
}

describe("GraphDetailPanel", () => {
  it("prompts to select when nothing is selected", () => {
    renderPanel();
    expect(screen.getByText("Select a node or edge to see details.")).toBeInTheDocument();
  });

  describe("several items selected", () => {
    it("summarizes the selection and lists each item", () => {
      renderPanel({
        selection: { nodes: [nodeA, nodeB], edges: [edge] },
        incidentEdgesByNode: new Map([
          [nodeA.id, [edge]],
          [nodeB.id, [edge]],
        ]),
      });

      expect(screen.getByText("Multiple selection")).toBeInTheDocument();
      expect(
        screen.getByText("2 proteins and 1 interaction selected."),
      ).toBeInTheDocument();

      const items = screen.getAllByRole("listitem");
      expect(items).toHaveLength(3);
      expect(within(items[0]).getByText("Ecaj_0270")).toBeInTheDocument();
      expect(within(items[0]).getByText("Interactions: 1")).toBeInTheDocument();
      // The card heading shows the gene, so its field list leaves the Gene row out.
      expect(within(items[1]).getByText("ftsA")).toBeInTheDocument();
      expect(within(items[2]).getByText("Detection method")).toBeInTheDocument();
    });

    it("leaves the Gene row out of a card whose heading already shows the gene", () => {
      renderPanel({ selection: { nodes: [nodeA, nodeB], edges: [] } });

      for (const card of screen.getAllByRole("listitem")) {
        expect(within(card).queryByText("Gene")).toBeNull();
        expect(within(card).getByText("BRC ID")).toBeInTheDocument();
        expect(within(card).getByText("Genome")).toBeInTheDocument();
      }
    });

    it("leaves the BRC ID row out of a card whose heading shows the id because the gene is missing", () => {
      const bare: GNode = { id: "fig|3.3", kind: "microbial" };
      renderPanel({ selection: { nodes: [nodeA, bare], edges: [] } });

      const card = screen.getAllByRole("listitem")[1];
      // The heading is the only place the id appears.
      expect(within(card).getByText("fig|3.3")).toBeInTheDocument();
      expect(within(card).queryByText("BRC ID")).toBeNull();
      // The remaining rows stay, with a placeholder for the missing gene.
      expect(within(card).getByText("Gene")).toBeInTheDocument();
      for (const label of ["Genome", "Locus tag", "Product"]) {
        expect(within(card).getByText(label)).toBeInTheDocument();
      }
      expect(within(card).getAllByText("—")).toHaveLength(4);
    });

    it("singularizes the summary", () => {
      renderPanel({ selection: { nodes: [nodeA], edges: [edge] } });
      expect(
        screen.getByText("1 protein and 1 interaction selected."),
      ).toBeInTheDocument();
    });

    it("does not offer incident-edge buttons for several nodes", () => {
      renderPanel({
        selection: { nodes: [nodeA, nodeB], edges: [] },
        incidentEdgesByNode: incident([edge]),
      });
      expect(screen.queryByRole("button")).toBeNull();
    });

    it("caps the cards per kind and says how many are not shown", () => {
      // The cap is a product contract (25 cards per kind), so it is spelled out here rather than
      // read from the component's constant, which a regression could change in step with the test.
      const many: GNode[] = Array.from({ length: 30 }, (_, i) => ({
        id: `fig|${String(i)}`,
        gene: `g${String(i)}`,
        kind: "microbial",
      }));
      renderPanel({ selection: { nodes: many, edges: [] } });

      expect(screen.getAllByRole("listitem")).toHaveLength(25);
      expect(
        screen.getByText("…and 5 more proteins not shown."),
      ).toBeInTheDocument();
    });

    it("closes each kind's list with its own note when both kinds are capped", () => {
      const manyNodes: GNode[] = Array.from({ length: 26 }, (_, i) => ({
        id: `fig|${String(i)}`,
        gene: `g${String(i)}`,
        kind: "microbial",
      }));
      const manyEdges: GEdge[] = Array.from({ length: 26 }, (_, i) => ({
        ...edge,
        id: `edge-${String(i)}`,
      }));
      renderPanel({ selection: { nodes: manyNodes, edges: manyEdges } });

      const proteinNote = screen.getByText("…and 1 more protein not shown.");
      const interactionNote = screen.getByText("…and 1 more interaction not shown.");
      expect(screen.getAllByRole("listitem")).toHaveLength(50);

      // The proteins note closes the protein cards, so it comes before the first interaction card.
      const firstEdgeCard = screen.getAllByText("Interaction", { selector: "p" })[0];
      expect(
        proteinNote.compareDocumentPosition(firstEdgeCard) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        firstEdgeCard.compareDocumentPosition(interactionNote) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  describe("one item selected", () => {
    it("draws the protein panel for a single protein", () => {
      renderPanel({ selection: { nodes: [nodeA], edges: [] } });

      expect(
        screen.getByRole("heading", { level: 2, name: "dnaA" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Identifiers")).toBeInTheDocument();
    });

    it("draws the interaction panel for a single interaction", () => {
      renderPanel({ selection: { nodes: [], edges: [edge] } });

      expect(
        screen.getByRole("heading", { level: 2, name: "Interaction" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Between dnaA and ftsA")).toBeInTheDocument();
    });

    it("starts a new protein with a closed Identifiers row and an empty partner filter", async () => {
      const user = userEvent.setup();
      const many = Array.from({ length: 10 }, (_, i): GNode => ({
        id: `fig|${String(i)}.partner`,
        gene: `p${String(i)}`,
        kind: "microbial",
      }));
      const edges = many.map(
        (partner, i): GEdge => ({ ...edge, id: `e${String(i)}`, target: partner.id }),
      );
      const edgesB = edges.map((e): GEdge => ({ ...e, id: `${e.id}b`, source: nodeB.id }));
      const props = {
        incidentEdgesByNode: new Map([[nodeA.id, edges]]),
        nodesById: new Map([nodeA, nodeB, ...many].map((n) => [n.id, n])),
      };
      const { rerender } = renderPanel({
        selection: { nodes: [nodeA], edges: [] },
        ...props,
      });

      await user.click(screen.getByText("Identifiers"));
      await user.type(screen.getByRole("searchbox", { name: "Filter partners" }), "p3");

      rerender(
        <GraphDetailPanel
          selection={{ nodes: [nodeB], edges: [] }}
          incidentEdgesByNode={new Map([[nodeB.id, edgesB]])}
          nodesById={props.nodesById}
          onSelectEdge={vi.fn()}
          onSelectNode={vi.fn()}
        />,
      );

      expect(screen.getByText("Identifiers").closest("details")).not.toHaveAttribute("open");
      expect(screen.getByRole("searchbox", { name: "Filter partners" })).toHaveValue("");
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
  });

  describe("links", () => {
    it("links each card of a multi-item selection, its heading included", () => {
      const unnamed: GNode = { ...linkedB, gene: undefined };
      renderPanel({
        selection: { nodes: [linkedA, unnamed], edges: [linkedEdge] },
        nodesById: linkedNodesById,
      });

      const [cardA, cardB, edgeCard] = screen.getAllByRole("listitem");
      // linkedA's heading is its gene; the unnamed node's heading is its BRC ID.
      expect(within(cardA).getByRole("link", { name: "hisD" })).toHaveAttribute(
        "href",
        "/feature/PATRIC.224914.16.CDS.1",
      );
      expect(within(cardB).getByRole("link", { name: linkedB.id })).toHaveAttribute(
        "href",
        "/feature/PATRIC.224914.16.CDS.2",
      );
      for (const card of [cardA, cardB]) {
        expect(
          within(card).getByRole("link", { name: "Brucella melitensis" }),
        ).toHaveAttribute("href", "/genome/224914.16");
      }
      expect(within(edgeCard).getByRole("link", { name: "metH" })).toHaveAttribute(
        "href",
        "/feature/PATRIC.224914.16.CDS.2",
      );
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });
});
