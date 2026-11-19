import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { GraphEdgePanel } from "../graph-edge-panel";
import type { GEdge, GNode } from "@/lib/interactions/types";

const from: GNode = {
  id: "fig|224914.16.peg.1",
  featureId: "PATRIC.224914.16.CDS.1",
  genomeId: "224914.16",
  genome: "Brucella melitensis",
  gene: "hisD",
  refseqLocusTag: "BME_0001",
  interactorDesc: "Histidinol dehydrogenase",
  kind: "microbial",
};
const to: GNode = {
  id: "fig|224914.16.peg.2",
  featureId: "PATRIC.224914.16.CDS.2",
  genomeId: "224914.16",
  genome: "Brucella melitensis",
  refseqLocusTag: "BME_0002",
  kind: "microbial",
};
const host: GNode = {
  id: "P12345",
  featureId: "stray-feature",
  genomeId: "9606.1",
  genome: "Homo sapiens",
  gene: "TP53",
  kind: "host",
};

const edge: GEdge = {
  id: "e1",
  source: from.id,
  target: to.id,
  evidence: "experimental",
  interactionType: "physical association",
  detectionMethod: "pull down",
  experimental: true,
};

interface Setup {
  edge?: GEdge;
  nodes?: GNode[];
  others?: GEdge[];
  onSelectEdge?: (edge: GEdge) => void;
  onSelectNode?: (node: GNode, additive: boolean) => void;
}

function renderPanel({
  edge: shown = edge,
  nodes = [from, to],
  others = [],
  onSelectEdge = vi.fn(),
  onSelectNode = vi.fn(),
}: Setup = {}) {
  const incidence = new Map<string, GEdge[]>();
  for (const e of [shown, ...others]) {
    for (const id of [e.source, e.target]) {
      incidence.set(id, [...(incidence.get(id) ?? []), e]);
    }
  }
  render(
    <GraphEdgePanel
      edge={shown}
      incidence={incidence}
      nodesById={new Map(nodes.map((n) => [n.id, n]))}
      onSelectEdge={onSelectEdge}
      onSelectNode={onSelectNode}
    />,
  );
}

describe("GraphEdgePanel", () => {
  describe("header", () => {
    it("names the interaction and the two proteins it joins", () => {
      renderPanel();

      expect(
        screen.getByRole("heading", { level: 2, name: "Interaction" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Between hisD and BME_0002")).toBeInTheDocument();
    });

    it("badges a verified interaction as verified", () => {
      renderPanel();

      expect(screen.getByText("verified")).toBeInTheDocument();
    });

    it("badges an interaction that is not experimentally verified as predicted", () => {
      renderPanel({ edge: { ...edge, experimental: false } });

      expect(screen.getByText("predicted")).toBeInTheDocument();
      expect(screen.queryByText("verified")).not.toBeInTheDocument();
    });
  });

  describe("the diagram", () => {
    it("says which two proteins are joined and how", () => {
      renderPanel();

      expect(
        screen.getByRole("img", {
          name: "hisD and BME_0002, joined by a verified interaction",
        }),
      ).toBeInTheDocument();
    });

    it("says predicted for an interaction that is not verified", () => {
      renderPanel({ edge: { ...edge, experimental: false } });

      expect(
        screen.getByRole("img", {
          name: "hisD and BME_0002, joined by a predicted interaction",
        }),
      ).toBeInTheDocument();
    });
  });

  describe("proteins", () => {
    it("lists the protein each end of the interaction is, with its product", () => {
      renderPanel();

      const rows = screen.getAllByRole("listitem");
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent("From");
      expect(rows[0]).toHaveTextContent("hisD");
      expect(rows[0]).toHaveTextContent("Histidinol dehydrogenase");
      expect(rows[1]).toHaveTextContent("To");
      expect(rows[1]).toHaveTextContent("BME_0002");
      expect(rows[1]).toHaveTextContent("No product annotation");
    });

    it("selects a protein from its row", async () => {
      const user = userEvent.setup();
      const onSelectNode = vi.fn();
      renderPanel({ onSelectNode });

      await user.click(
        within(screen.getAllByRole("listitem")[1]).getByText("BME_0002"),
      );

      expect(onSelectNode).toHaveBeenCalledWith(to, false);
    });

    it("selects a protein from its crosshair button", async () => {
      const user = userEvent.setup();
      const onSelectNode = vi.fn();
      renderPanel({ onSelectNode });

      await user.click(screen.getByRole("button", { name: "Select hisD" }));

      expect(onSelectNode).toHaveBeenCalledTimes(1);
      expect(onSelectNode).toHaveBeenCalledWith(from, false);
    });

    it("shows an end missing from the node index by its short id, and cannot select it", async () => {
      // The row's button is disabled, which pointer-events checks treat as unclickable.
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      const onSelectNode = vi.fn();
      renderPanel({ nodes: [from], onSelectNode });

      const row = screen.getAllByRole("listitem")[1];
      expect(row).toHaveTextContent("peg.2");
      expect(
        within(row).queryByRole("button", { name: /^Select/ }),
      ).not.toBeInTheDocument();
      await user.click(within(row).getByText("peg.2"));
      expect(onSelectNode).not.toHaveBeenCalled();
    });
  });

  describe("evidence", () => {
    it("shows the interaction type, detection method and evidence", () => {
      renderPanel();

      for (const [label, value] of [
        ["Interaction type", "physical association"],
        ["Detection method", "pull down"],
        ["Evidence", "experimental"],
      ] as const) {
        expect(screen.getByText(label, { selector: "dt" })).toBeInTheDocument();
        expect(screen.getByText(value, { selector: "dd" })).toBeInTheDocument();
      }
    });

    it("shows a dash for each blank field", () => {
      renderPanel({
        edge: { ...edge, interactionType: "", detectionMethod: "", evidence: "" },
      });

      expect(screen.getAllByText("—", { selector: "dd" })).toHaveLength(3);
    });
  });

  describe("identifiers", () => {
    it("starts closed, showing both locus tags", () => {
      renderPanel();

      const summary = screen.getByText("Identifiers").closest("summary");
      expect(summary?.closest("details")).not.toHaveAttribute("open");
      expect(summary).toHaveTextContent("BME_0001 · BME_0002");
    });

    it("opens to each end's genome, locus tag and BRC id, linked to their pages", async () => {
      const user = userEvent.setup();
      renderPanel();

      await user.click(screen.getByText("Identifiers"));

      expect(screen.getByRole("link", { name: from.id })).toHaveAttribute(
        "href",
        "/feature/PATRIC.224914.16.CDS.1",
      );
      expect(screen.getByRole("link", { name: to.id })).toHaveAttribute(
        "href",
        "/feature/PATRIC.224914.16.CDS.2",
      );
      expect(
        screen.getAllByRole("link", { name: "Brucella melitensis" }),
      ).toHaveLength(2);
    });

    it("never links a host protein", () => {
      renderPanel({
        edge: { ...edge, target: host.id },
        nodes: [from, host],
      });

      expect(screen.getByText("Homo sapiens")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: host.id })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Homo sapiens" })).not.toBeInTheDocument();
    });

    it("shows dashes for an end that is not in the node index", () => {
      renderPanel({ nodes: [from] });

      expect(screen.getAllByText("—").length).toBeGreaterThan(0);
      expect(screen.queryByRole("link", { name: to.id })).not.toBeInTheDocument();
    });
  });

  describe("other records between the same two proteins", () => {
    it("is left out when the pair has one record", () => {
      renderPanel();

      expect(screen.queryByText("Also between these two")).not.toBeInTheDocument();
    });

    it("lists the other records, in either direction, and opens one", async () => {
      const user = userEvent.setup();
      const onSelectEdge = vi.fn();
      const reverse: GEdge = {
        ...edge,
        id: "e2",
        source: to.id,
        target: from.id,
        interactionType: "colocalization",
        experimental: false,
      };
      renderPanel({ others: [reverse], onSelectEdge });

      expect(screen.getByText("Also between these two")).toBeInTheDocument();
      expect(screen.getByText("1 record")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /colocalization/ }));

      expect(onSelectEdge).toHaveBeenCalledWith(reverse);
    });

    it("does not list a record between another pair", () => {
      const elsewhere: GEdge = { ...edge, id: "e3", target: host.id };
      renderPanel({ others: [elsewhere], nodes: [from, to, host] });

      expect(screen.queryByText("Also between these two")).not.toBeInTheDocument();
    });
  });
});
