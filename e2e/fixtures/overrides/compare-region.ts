import type { JsonOverride } from "../../mocks/backends";
import rows10 from "../compare-region/rows-10.json" with { type: "json" };

/** The fixture's focus gene (row 0's first feature) as its `genome_feature` record. */
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
 * `/api/compare-region` for the Feature View's Compare Region tab: ten
 * genomes' regions as the route answers them (`{rows}`), saved from one SEED
 * `compare_regions_for_peg2` answer. The panel fetches the route from the
 * browser, so this browser-side override is the whole mock; the loopback has
 * no compare-region endpoint and is never reached. The rows' focus gene
 * (`fig|1004954.3.peg.1`) is not the fixture feature's: the panel draws
 * whatever the route answers.
 *
 * A click on a gene pins its card, which reads the gene's record by its
 * BRC ID (`/api/data/genome_feature?operation=member&idField=patric_id`).
 * That read is answered here, ahead of `genomeFeatureScenarioOverrides`,
 * whose GET answers a collection's rows, not a member's `{row}`.
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
