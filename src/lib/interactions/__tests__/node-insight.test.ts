import {
  buildNodeStats,
  nodeLabel,
  nodeProduct,
  nodeSearchText,
  partnersOf,
  plural,
  rankByLinks,
  shortId,
  siblingEdges,
  statsOf,
} from "../node-insight";
import type { GEdge, GNode } from "../types";

const hub: GNode = { id: "fig|1.1.peg.1", gene: "dnaA", kind: "microbial" };
const mid: GNode = {
  id: "fig|1.1.peg.2",
  refseqLocusTag: "PMI0002",
  interactorDesc: "  Ribosomal protein  ",
  genome: "Proteus mirabilis HI4320",
  kind: "microbial",
};
const leaf: GNode = { id: "fig|1.1.peg.3", kind: "microbial" };
const host: GNode = { id: "P12345", gene: "TP53", kind: "host" };

function edge(
  id: string,
  source: GNode,
  target: GNode,
  experimental: boolean,
): GEdge {
  return {
    id,
    source: source.id,
    target: target.id,
    evidence: experimental ? "experimental" : "computational",
    interactionType: "interaction",
    detectionMethod: "method",
    experimental,
  };
}

const eHubMid = edge("e1", hub, mid, true);
const eHubLeaf = edge("e2", hub, leaf, false);
const eMidLeaf = edge("e3", mid, leaf, false);
const eMidLeafAgain = edge("e4", leaf, mid, true);

const edges = [eHubMid, eHubLeaf, eMidLeaf, eMidLeafAgain];

function indexEdges(list: GEdge[]): Map<string, GEdge[]> {
  const index = new Map<string, GEdge[]>();
  for (const e of list) {
    for (const id of [e.source, e.target]) {
      const bucket = index.get(id) ?? [];
      bucket.push(e);
      index.set(id, bucket);
    }
  }
  return index;
}

const incidence = indexEdges(edges);
const nodes = [leaf, mid, hub, host];
const nodesById = new Map(nodes.map((n) => [n.id, n]));

describe("shortId", () => {
  it("keeps the last two parts of a BRC feature id", () => {
    expect(shortId("fig|529507.6.peg.1556")).toBe("peg.1556");
  });

  it("leaves any other id alone", () => {
    expect(shortId("P12345")).toBe("P12345");
  });
});

describe("nodeLabel", () => {
  it("prefers the gene, then the locus tag, then the short id", () => {
    expect(nodeLabel(hub)).toBe("dnaA");
    expect(nodeLabel(mid)).toBe("PMI0002");
    expect(nodeLabel(leaf)).toBe("peg.3");
  });
});

describe("nodeProduct", () => {
  it("trims the product and returns an empty string when there is none", () => {
    expect(nodeProduct(mid)).toBe("Ribosomal protein");
    expect(nodeProduct(hub)).toBe("");
  });
});

describe("buildNodeStats", () => {
  it("counts a protein's interactions and how many are verified", () => {
    const stats = buildNodeStats(nodes, incidence);

    expect(statsOf(stats, hub)).toEqual({
      degree: 2,
      experimental: 1,
      predicted: 1,
    });
    expect(statsOf(stats, mid)).toEqual({
      degree: 3,
      experimental: 2,
      predicted: 1,
    });
  });

  it("reports a protein with no interactions as zero", () => {
    const stats = buildNodeStats(nodes, incidence);

    expect(statsOf(stats, host)).toEqual({
      degree: 0,
      experimental: 0,
      predicted: 0,
    });
  });

  it("reads a node it has no entry for as zero", () => {
    expect(statsOf(new Map(), hub).degree).toBe(0);
  });
});

describe("rankByLinks", () => {
  it("puts the best-connected protein first and breaks ties by name", () => {
    const stats = buildNodeStats(nodes, incidence);

    // `mid` and `leaf` both have 3 interactions; "peg.3" sorts before "PMI0002".
    expect(rankByLinks(nodes, stats).map((n) => n.id)).toEqual([
      leaf.id,
      mid.id,
      hub.id,
      host.id,
    ]);
  });

  it("does not reorder the list it was given", () => {
    const stats = buildNodeStats(nodes, incidence);
    const before = nodes.map((n) => n.id);

    rankByLinks(nodes, stats);

    expect(nodes.map((n) => n.id)).toEqual(before);
  });

  it("orders names with numbers naturally", () => {
    const a: GNode = { id: "a", gene: "rpl2", kind: "microbial" };
    const b: GNode = { id: "b", gene: "rpl10", kind: "microbial" };

    expect(rankByLinks([b, a], new Map()).map((n) => n.id)).toEqual(["a", "b"]);
  });
});

describe("nodeSearchText", () => {
  it("joins the name, id, locus tag, product and genome, lower-cased", () => {
    const text = nodeSearchText(mid);

    expect(text).toContain("fig|1.1.peg.2");
    expect(text).toContain("pmi0002");
    expect(text).toContain("ribosomal protein");
    expect(text).toContain("proteus mirabilis hi4320");
  });

  it("skips fields a protein does not have", () => {
    expect(nodeSearchText(leaf)).toBe("fig|1.1.peg.3");
  });
});

describe("partnersOf", () => {
  it("groups every interaction shared with a partner and flags a verified one", () => {
    const partners = partnersOf(mid, incidence, nodesById);
    const withLeaf = partners.find((p) => p.node.id === leaf.id);

    expect(withLeaf?.edges.map((e) => e.id)).toEqual(["e3", "e4"]);
    expect(withLeaf?.verified).toBe(true);
    expect(withLeaf?.degree).toBe(3);
  });

  it("lists verified partners first, then the better connected", () => {
    const partners = partnersOf(mid, incidence, nodesById);

    // The leaf shares a verified record with `mid` and has 3 links; the hub's one record is verified
    // too but it has fewer links.
    expect(partners.map((p) => p.node.id)).toEqual([leaf.id, hub.id]);
  });

  it("skips a partner that is not in the node index", () => {
    const partial = new Map([[hub.id, hub]]);

    expect(partnersOf(hub, incidence, partial)).toEqual([]);
  });

  it("returns nothing for a protein without interactions", () => {
    expect(partnersOf(host, incidence, nodesById)).toEqual([]);
  });
});

describe("siblingEdges", () => {
  it("finds the other records between the same two proteins, either way round", () => {
    expect(siblingEdges(eMidLeaf, incidence).map((e) => e.id)).toEqual(["e4"]);
    expect(siblingEdges(eMidLeafAgain, incidence).map((e) => e.id)).toEqual([
      "e3",
    ]);
  });

  it("returns nothing when the pair has a single record", () => {
    expect(siblingEdges(eHubMid, incidence)).toEqual([]);
  });
});

describe("plural", () => {
  it("picks the singular for one and groups thousands", () => {
    expect(plural(1, "protein", "proteins")).toBe("1 protein");
    expect(plural(0, "protein", "proteins")).toBe("0 proteins");
    expect(plural(2593, "protein", "proteins")).toBe("2,593 proteins");
  });
});
