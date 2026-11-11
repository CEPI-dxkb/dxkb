import type { JsonOverride } from "../../mocks/backends";
import rows10 from "../compare-region/rows-10.json" with { type: "json" };

export const compareRegionFocusRecord = {
  feature_id: "PATRIC.1004954.3.AFFC01000001.CDS.67.684.rev",
  patric_id: "fig|1004954.3.peg.1",
  genome_id: "1004954.3",
  genome_name: "Brucella suis bv. 1 str. S2",
  taxon_id: 1004954,
  annotation: "PATRIC",
  feature_type: "CDS",
  accession: "AFFC01000001",
  start: 67,
  end: 684,
  strand: "-",
  na_length: 618,
  aa_length: 205,
  product:
    "SSU ribosomal protein S4p (S9e) @ SSU ribosomal protein S4p (S9e), zinc-independent",
  pgfam_id: "PGF_00049893",
};

/**
 * Ten genomes' regions saved from one SEED `compare_regions_for_peg2` answer.
 * The panel fetches this from the browser, so the loopback is never reached.
 * A gene click reads its record as a member via `/api/data/genome_feature`,
 * answered here ahead of `genomeFeatureScenarioOverrides`, whose GET answers
 * collection rows.
 */
export const compareRegionScenarioOverrides: JsonOverride[] = [
  {
    url: /\/api\/compare-region(?:\?|$)/,
    method: "GET",
    body: rows10,
  },
  {
    url: /\/api\/data\/genome_feature\?(?=.*operation=member)(?=.*idField=patric_id)/,
    method: "GET",
    body: { row: compareRegionFocusRecord },
  },
];
