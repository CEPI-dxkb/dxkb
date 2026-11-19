// What the Graph subview's protein list and selection panel say about a protein: its display label,
// how connected it is, and who it interacts with. Pure, so the views stay thin and the ranking is
// unit-tested.
import type { GEdge, GNode } from "./types";

export interface NodeStats {
  /** Interactions the protein takes part in. */
  degree: number;
  /** How many of them are experimentally verified (an indigo line on the canvas). */
  experimental: number;
  predicted: number;
}

/** One interaction partner: every interaction the selected protein shares with it. */
export interface Partner {
  node: GNode;
  edges: GEdge[];
  /** True when any of the shared interactions is experimentally verified. */
  verified: boolean;
  /** How many interactions the partner has overall. */
  degree: number;
}

const noStats: NodeStats = { degree: 0, experimental: 0, predicted: 0 };

/** `fig|529507.6.peg.1556` becomes `peg.1556`: the genome is already the page's context. */
export function shortId(id: string): string {
  if (!id.startsWith("fig|")) return id;
  return id.split(".").slice(-2).join(".");
}

/** The name a protein goes by: its gene, else its locus tag, else its short BRC ID. */
export function nodeLabel(node: GNode): string {
  return node.gene || node.refseqLocusTag || shortId(node.id);
}

export function nodeProduct(node: GNode): string {
  return node.interactorDesc?.trim() ?? "";
}

export function compareByLabel(a: GNode, b: GNode): number {
  return nodeLabel(a).localeCompare(nodeLabel(b), undefined, { numeric: true });
}

export function buildNodeStats(
  nodes: readonly GNode[],
  incidence: ReadonlyMap<string, readonly GEdge[]>,
): Map<string, NodeStats> {
  const stats = new Map<string, NodeStats>();
  for (const node of nodes) {
    const edges = incidence.get(node.id) ?? [];
    const experimental = edges.filter((edge) => edge.experimental).length;
    stats.set(node.id, {
      degree: edges.length,
      experimental,
      predicted: edges.length - experimental,
    });
  }
  return stats;
}

export function statsOf(
  stats: ReadonlyMap<string, NodeStats>,
  node: GNode,
): NodeStats {
  return stats.get(node.id) ?? noStats;
}

/** Most interactions first, then by name; the input order is left alone. */
export function rankByLinks(
  nodes: readonly GNode[],
  stats: ReadonlyMap<string, NodeStats>,
): GNode[] {
  return [...nodes].sort(
    (a, b) =>
      statsOf(stats, b).degree - statsOf(stats, a).degree ||
      compareByLabel(a, b),
  );
}

/** Lower-cased text the list's search looks through: name, product, locus tag, genome and BRC ID. */
export function nodeSearchText(node: GNode): string {
  return [
    node.gene,
    node.id,
    node.refseqLocusTag,
    node.interactorDesc,
    node.genome,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Verified partners first, then the best connected, then by name. */
export function partnersOf(
  node: GNode,
  incidence: ReadonlyMap<string, readonly GEdge[]>,
  nodesById: ReadonlyMap<string, GNode>,
): Partner[] {
  const byId = new Map<string, Partner>();
  for (const edge of incidence.get(node.id) ?? []) {
    const otherId = edge.source === node.id ? edge.target : edge.source;
    const other = nodesById.get(otherId);
    if (!other) continue;
    const existing = byId.get(otherId);
    if (existing) {
      existing.edges.push(edge);
      existing.verified ||= edge.experimental;
    } else {
      byId.set(otherId, {
        node: other,
        edges: [edge],
        verified: edge.experimental,
        degree: incidence.get(otherId)?.length ?? 0,
      });
    }
  }
  return [...byId.values()].sort(
    (a, b) =>
      Number(b.verified) - Number(a.verified) ||
      b.degree - a.degree ||
      compareByLabel(a.node, b.node),
  );
}

/** The other records between the two proteins an interaction joins. */
export function siblingEdges(
  edge: GEdge,
  incidence: ReadonlyMap<string, readonly GEdge[]>,
): GEdge[] {
  return (incidence.get(edge.source) ?? []).filter(
    (other) =>
      other.id !== edge.id &&
      ((other.source === edge.source && other.target === edge.target) ||
        (other.source === edge.target && other.target === edge.source)),
  );
}

export function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`;
}
