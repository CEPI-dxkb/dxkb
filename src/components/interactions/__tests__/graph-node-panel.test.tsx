import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { GraphNodePanel } from "../graph-node-panel";
import type { GEdge, GNode } from "@/lib/interactions/types";

const center: GNode = {
  id: "fig|224914.16.peg.1",
  featureId: "PATRIC.224914.16.CDS.1",
  genomeId: "224914.16",
  genome: "Brucella melitensis",
  gene: "hisD",
  refseqLocusTag: "BME_0001",
  interactorDesc: "Histidinol dehydrogenase",
  kind: "microbial",
};

function partnerNode(index: number, extra: Partial<GNode> = {}): GNode {
  return {
    id: `fig|224914.16.peg.${String(100 + index)}`,
    gene: `p${String(index)}`,
    interactorDesc: `Product ${String(index)}`,
    kind: "microbial",
    ...extra,
  };
}

function edgeBetween(
  id: string,
  source: GNode,
  target: GNode,
  extra: Partial<GEdge> = {},
): GEdge {
  return {
    id,
    source: source.id,
    target: target.id,
    evidence: "experimental",
    interactionType: "physical association",
    detectionMethod: "pull down",
    experimental: false,
    ...extra,
  };
}

interface Setup {
  node?: GNode;
  partners?: GNode[];
  edges?: GEdge[];
  onSelectEdge?: (edge: GEdge) => void;
  onSelectNode?: (node: GNode, additive: boolean) => void;
  onFocusNode?: (node: GNode) => void;
}

function renderPanel({
  node = center,
  partners = [],
  edges,
  onSelectEdge = vi.fn(),
  onSelectNode = vi.fn(),
  onFocusNode,
}: Setup = {}) {
  const all =
    edges ?? partners.map((p, i) => edgeBetween(`e${String(i)}`, node, p));
  const incidence = new Map<string, GEdge[]>();
  for (const e of all) {
    for (const id of [e.source, e.target]) {
      incidence.set(id, [...(incidence.get(id) ?? []), e]);
    }
  }
  const nodesById = new Map([node, ...partners].map((n) => [n.id, n]));
  render(
    <GraphNodePanel
      node={node}
      incidence={incidence}
      nodesById={nodesById}
      onSelectEdge={onSelectEdge}
      onSelectNode={onSelectNode}
      onFocusNode={onFocusNode}
    />,
  );
  return { all };
}

const manyPartners = (count: number) =>
  Array.from({ length: count }, (_, i) => partnerNode(i));

describe("GraphNodePanel", () => {
  describe("header", () => {
    it("names the protein, its kind and its product", () => {
      renderPanel();

      expect(
        screen.getByRole("heading", { level: 2, name: "hisD" }),
      ).toBeInTheDocument();
      expect(screen.getByText("microbial")).toBeInTheDocument();
      expect(screen.getByText("Histidinol dehydrogenase")).toBeInTheDocument();
    });

    it("falls back to the locus tag, then the short BRC id, for the name", () => {
      renderPanel({ node: { ...center, gene: undefined } });
      expect(
        screen.getByRole("heading", { level: 2, name: "BME_0001" }),
      ).toBeInTheDocument();
    });

    it("says so when the protein has no product annotation", () => {
      renderPanel({ node: { ...center, interactorDesc: undefined } });

      expect(screen.getByText("No product annotation")).toBeInTheDocument();
    });

    it("offers Focus right under the name when a handler is given", async () => {
      const user = userEvent.setup();
      const onFocusNode = vi.fn();
      renderPanel({ onFocusNode });

      await user.click(
        screen.getByRole("button", { name: "Focus on this protein" }),
      );

      expect(onFocusNode).toHaveBeenCalledWith(center);
    });

    it("draws no Focus button without a handler", () => {
      renderPanel();

      expect(
        screen.queryByRole("button", { name: "Focus on this protein" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("identifiers", () => {
    it("starts closed, showing the locus tag", () => {
      renderPanel();

      const summary = screen.getByText("Identifiers").closest("summary");
      expect(summary?.closest("details")).not.toHaveAttribute("open");
      expect(summary).toHaveTextContent("BME_0001");
    });

    it("shows the short BRC id in the summary when there is no locus tag", () => {
      renderPanel({ node: { ...center, refseqLocusTag: undefined } });

      expect(screen.getByText("Identifiers").closest("summary")).toHaveTextContent(
        "peg.1",
      );
    });

    it("opens to the genome, locus tag and full BRC id, linked to their pages", async () => {
      const user = userEvent.setup();
      renderPanel();

      await user.click(screen.getByText("Identifiers"));

      expect(screen.getByText("Identifiers").closest("details")).toHaveAttribute(
        "open",
      );
      expect(
        screen.getByRole("link", { name: "Brucella melitensis" }),
      ).toHaveAttribute("href", "/genome/224914.16");
      expect(screen.getByRole("link", { name: center.id })).toHaveAttribute(
        "href",
        "/feature/PATRIC.224914.16.CDS.1",
      );
      expect(screen.getAllByText("BME_0001").length).toBeGreaterThan(0);
    });

    it("never links a host protein", () => {
      renderPanel({
        node: {
          ...center,
          kind: "host",
          id: "P12345",
          genome: "Homo sapiens",
          genomeId: "9606.1",
        },
      });

      expect(screen.getByText("Homo sapiens")).toBeInTheDocument();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    it("leaves a genome that is not a genome id unlinked", () => {
      renderPanel({ node: { ...center, genomeId: "not-a-genome-id" } });

      expect(screen.getByText("Brucella melitensis")).toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "Brucella melitensis" }),
      ).not.toBeInTheDocument();
    });

    it("shows the genome id when the name is missing", () => {
      renderPanel({ node: { ...center, genome: undefined } });
      expect(screen.getByRole("link", { name: "224914.16" })).toHaveAttribute(
        "href",
        "/genome/224914.16",
      );
    });

    it("shows a dash for a missing genome and locus tag", () => {
      renderPanel({
        node: {
          id: "fig|1.1",
          kind: "microbial",
        },
      });

      expect(screen.getAllByText("—")).toHaveLength(2);
    });
  });

  describe("interactions", () => {
    it("counts the protein's interactions in the heading", () => {
      renderPanel({ partners: manyPartners(3) });

      expect(
        screen.getByRole("heading", { level: 3, name: "Interactions (3)" }),
      ).toBeInTheDocument();
    });

    it("lists verified partners first, then the better connected", () => {
      const [a, b, c] = manyPartners(3);
      const edges = [
        edgeBetween("e0", center, a),
        edgeBetween("e1", center, b, { experimental: true }),
        edgeBetween("e2", center, c),
        edgeBetween("e3", c, a),
      ];
      renderPanel({ partners: [a, b, c], edges });

      const rows = within(screen.getByRole("list")).getAllByRole("listitem");
      // b is verified; a and c are predicted, but a and c have two links each, b only one.
      expect(rows.map((row) => row.textContent)).toEqual([
        expect.stringContaining("p1"),
        expect.stringContaining("p0"),
        expect.stringContaining("p2"),
      ]);
    });

    it("names each row's partner and detection method", () => {
      renderPanel({ partners: manyPartners(1) });

      const row = screen.getByRole("listitem");
      expect(within(row).getByText("p0")).toBeInTheDocument();
      expect(within(row).getByText("pull down")).toBeInTheDocument();
    });

    it("opens the interaction when a row is clicked", async () => {
      const user = userEvent.setup();
      const onSelectEdge = vi.fn();
      const { all } = renderPanel({
        partners: manyPartners(2),
        onSelectEdge,
      });

      const rows = within(screen.getByRole("list")).getAllByRole("listitem");
      await user.click(within(rows[0]).getByText("p0"));

      expect(onSelectEdge).toHaveBeenCalledWith(all[0]);
    });

    it("opens the first of several interactions shared with a partner", async () => {
      const user = userEvent.setup();
      const onSelectEdge = vi.fn();
      const [p] = manyPartners(1);
      const first = edgeBetween("e0", center, p);
      const second = edgeBetween("e1", p, center);
      renderPanel({ partners: [p], edges: [first, second], onSelectEdge });

      await user.click(within(screen.getByRole("list")).getByText("p0"));

      expect(onSelectEdge).toHaveBeenCalledWith(first);
    });

    it("selects the partner itself from the row's crosshair", async () => {
      const user = userEvent.setup();
      const onSelectNode = vi.fn();
      const [p] = manyPartners(1);
      renderPanel({ partners: [p], onSelectNode });

      await user.click(
        within(screen.getByRole("list")).getByRole("button", {
          name: "Select p0",
        }),
      );

      expect(onSelectNode).toHaveBeenCalledWith(p, false);
    });

    it("says there are none when the protein has no interactions, and draws no diagram", () => {
      renderPanel({ partners: [] });

      expect(
        screen.getByText("No interactions in the graph."),
      ).toBeInTheDocument();
      expect(screen.queryByRole("group", { name: /partner/ })).toBeNull();
    });

    it("skips a partner missing from the node index", () => {
      const ghost = partnerNode(7);
      const edges = [edgeBetween("e0", center, ghost)];
      renderPanel({ partners: [], edges });

      expect(
        screen.getByRole("heading", { level: 3, name: "Interactions (1)" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    });
  });

  describe("the diagram", () => {
    const diagram = () => screen.getByRole("group", { name: /partner/ });

    it("names the protein and how many partners it draws around it", () => {
      renderPanel({ partners: manyPartners(3) });

      expect(diagram()).toHaveAccessibleName("hisD and 3 partners");
    });

    it("draws each partner on the ring and selects it on a click", async () => {
      const user = userEvent.setup();
      const onSelectNode = vi.fn();
      const partners = manyPartners(3);
      renderPanel({ partners, onSelectNode });

      await user.click(within(diagram()).getByRole("button", { name: "Select p1" }));

      expect(onSelectNode).toHaveBeenCalledWith(partners[1], false);
    });

    it.each(["{Enter}", " "])("selects a partner from the keyboard with %j", async (key) => {
      const user = userEvent.setup();
      const onSelectNode = vi.fn();
      const partners = manyPartners(2);
      renderPanel({ partners, onSelectNode });

      within(diagram()).getByRole("button", { name: "Select p0" }).focus();
      await user.keyboard(key);

      expect(onSelectNode).toHaveBeenCalledWith(partners[0], false);
    });

    it("puts ten partners on the ring and points the rest to the list", () => {
      renderPanel({ partners: manyPartners(13) });

      expect(within(diagram()).getAllByRole("button")).toHaveLength(10);
      expect(within(diagram()).getByText("+3 more below")).toBeInTheDocument();
    });

    it("clips a long name so it stays inside the drawing", () => {
      const long = partnerNode(0, { gene: "averyverylonggenename" });
      renderPanel({ partners: [long] });

      expect(within(diagram()).getByText("averyveryl…")).toBeInTheDocument();
    });
  });

  describe("the partner filter", () => {
    it("appears only for a protein with more than eight partners", () => {
      const { all } = renderPanel({ partners: manyPartners(8) });
      expect(all).toHaveLength(8);
      expect(
        screen.queryByRole("searchbox", { name: "Filter partners" }),
      ).not.toBeInTheDocument();
    });

    it("narrows the list by name or product", async () => {
      const user = userEvent.setup();
      renderPanel({ partners: manyPartners(12) });
      const filter = screen.getByRole("searchbox", { name: "Filter partners" });

      await user.type(filter, "p11");
      expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(1);

      await user.clear(filter);
      await user.type(filter, "product 3");
      const rows = within(screen.getByRole("list")).getAllByRole("listitem");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveTextContent("p3");
    });

    it("says when nothing matches", async () => {
      const user = userEvent.setup();
      renderPanel({ partners: manyPartners(12) });

      await user.type(
        screen.getByRole("searchbox", { name: "Filter partners" }),
        "zzz",
      );

      expect(screen.getByText("No partners match.")).toBeInTheDocument();
    });

    it("lists forty partners and reveals the rest on request", async () => {
      const user = userEvent.setup();
      renderPanel({ partners: manyPartners(45) });
      const list = screen.getByRole("list");

      expect(within(list).getAllByRole("listitem")).toHaveLength(40);

      await user.click(screen.getByRole("button", { name: "Show all 45" }));

      expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(45);
      expect(
        screen.queryByRole("button", { name: "Show all 45" }),
      ).not.toBeInTheDocument();
    });
  });
});
