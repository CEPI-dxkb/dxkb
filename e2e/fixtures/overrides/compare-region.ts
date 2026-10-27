import type { JsonOverride } from "../../mocks/backends";
import rows10 from "../compare-region/rows-10.json" with { type: "json" };

/**
 * `/api/compare-region` for the Feature View's Compare Region tab: ten
 * genomes' regions as the route answers them (`{rows}`), saved from one SEED
 * `compare_regions_for_peg2` answer. The panel fetches the route from the
 * browser, so this browser-side override is the whole mock; the loopback has
 * no compare-region endpoint and is never reached. The rows' focus gene
 * (`fig|1004954.3.peg.1`) is not the fixture feature's: the panel draws
 * whatever the route answers.
 */
export const compareRegionScenarioOverrides: JsonOverride[] = [
  {
    url: /\/api\/compare-region(?:\?|$)/,
    method: "GET",
    body: rows10,
  },
];
