import type { JsonOverride } from "../../mocks/backends";

// Match the resource path independently of origin. NEXT_PUBLIC_DATA_API is embedded
// at build time, so a build made without .env.e2e.test can still target the public
// API while Playwright intercepts it before any network request leaves the browser.
const ppiRequest = /\/ppi\//;
// The count query is the only PPI request ending in limit(1). Keep the end anchor so
// facet requests containing limit(1) continue to fall through to the row fixture.
const ppiCountRequest = /\/ppi\/.*limit(?:\(1\)|%281%29)$/;

export interface MockPpiRow {
  id: string;
  genome_id_a: string;
  genome_name_a: string;
  interactor_a: string;
  feature_id_a: string;
  refseq_locus_tag_a: string;
  gene_a: string;
  interactor_desc_a: string;
  genome_id_b: string;
  genome_name_b: string;
  interactor_b: string;
  feature_id_b: string;
  refseq_locus_tag_b: string;
  gene_b: string;
  interactor_desc_b: string;
  category: string;
  interaction_type: string[];
  detection_method: string[];
  evidence: string[];
  score: number;
}

/** Build `count` synthetic PPI rows for the Brucella melitensis (taxon 234) fixture. */
export function buildPpiRows(count: number): MockPpiRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `ppi-${String(i).padStart(4, "0")}`,
    genome_id_a: "224914.16",
    genome_name_a: "Brucella melitensis bv. 1 str. 16M [WGS]",
    interactor_a: `fig|224914.16.peg.${String(600 + i)}`,
    feature_id_a: `PATRIC.224914.16.feature-a-${String(i)}`,
    refseq_locus_tag_a: `BAWG_${String(1000 + i)}`,
    gene_a: "",
    interactor_desc_a: "6,7-dimethyl-8-ribityllumazine synthase",
    genome_id_b: "224914.16",
    genome_name_b: "Brucella melitensis bv. 1 str. 16M [WGS]",
    interactor_b: `fig|224914.16.peg.${String(2400 + i)}`,
    feature_id_b: `PATRIC.224914.16.feature-b-${String(i)}`,
    refseq_locus_tag_b: `BAWG_${String(2000 + i)}`,
    gene_b: "",
    interactor_desc_b: "CrcB protein",
    category: "PPI",
    interaction_type: ["predicted interaction"],
    detection_method: ["predictive text mining"],
    evidence: ["experimental"],
    score: 2.5316925,
  }));
}

/** Build origin-independent PPI count and row overrides for browser requests. */
export function buildPpiOverrides(rows: MockPpiRow[]): JsonOverride[] {
  return [
    // Narrowest first: matching is first-match, and the count URL also satisfies both broad
    // patterns below, so any broad entry placed ahead of it would swallow the count request.
    { url: ppiCountRequest, method: "GET", body: { response: { numFound: rows.length } } },
    {
      url: /api\/data\/ppi/,
      method: "GET",
      body: { rows, total: rows.length, facets: {}, page: 1, pageSize: 200 },
    },
    { url: ppiRequest, method: "GET", body: rows },
  ];
}
