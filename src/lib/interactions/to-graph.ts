import type { PpiRecord, GNode, GEdge } from "./types";

const pathogenDomains = ["Bacteria", "Archaea"];

function asText(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v.join(", ");
  return v ?? "";
}

function nodeFrom(d: PpiRecord, ab: "a" | "b"): GNode {
  const domain = ab === "a" ? d.domain_a : d.domain_b;
  return {
    id: ab === "a" ? d.interactor_a : d.interactor_b,
    interactorType: ab === "a" ? d.interactor_type_a : d.interactor_type_b,
    interactorDesc: ab === "a" ? d.interactor_desc_a : d.interactor_desc_b,
    featureId: ab === "a" ? d.feature_id_a : d.feature_id_b,
    gene: ab === "a" ? d.gene_a : d.gene_b,
    genomeId: ab === "a" ? d.genome_id_a : d.genome_id_b,
    genome: ab === "a" ? d.genome_name_a : d.genome_name_b,
    refseqLocusTag: ab === "a" ? d.refseq_locus_tag_a : d.refseq_locus_tag_b,
    kind: domain && !pathogenDomains.includes(domain) ? "host" : "microbial",
  };
}

export function toGraph(rows: PpiRecord[]): { nodes: GNode[]; edges: GEdge[] } {
  const nodes = new Map<string, GNode>();
  const edges: GEdge[] = [];

  for (const d of rows) {
    if (!nodes.has(d.interactor_a)) nodes.set(d.interactor_a, nodeFrom(d, "a"));
    if (!nodes.has(d.interactor_b)) nodes.set(d.interactor_b, nodeFrom(d, "b"));

    const evidence = asText(d.evidence);
    edges.push({
      id: d.id,
      source: d.interactor_a,
      target: d.interactor_b,
      evidence,
      interactionType: asText(d.interaction_type),
      detectionMethod: asText(d.detection_method),
      experimental: evidence.toLowerCase().includes("experimental"),
    });
  }

  return { nodes: [...nodes.values()], edges };
}
