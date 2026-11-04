import type { JsonOverride } from "../../mocks/backends";
import { bacterialGenomeRecord } from "@/lib/e2e-fixtures/records";

const genomeId = bacterialGenomeRecord.genome_id;
const accession = "NC_E2E001";
const length = 50_000;
const windowSize = 50;
const windows = length / windowSize;

/** Covers the first half of the circle, so a spec can hover it at 3 o'clock. */
const forwardFeature = {
  featureId: `PATRIC.${genomeId}.${accession}.CDS.1.25000.fwd`,
  patricId: `fig|${genomeId}.peg.1`,
  accession,
  start: 1,
  end: 25_000,
  strand: "+",
  featureType: "CDS",
  product: "E2E forward CDS",
};

const customFeature = {
  featureId: `PATRIC.${genomeId}.${accession}.CDS.30001.32000.rev`,
  patricId: `fig|${genomeId}.peg.2`,
  accession,
  start: 30_001,
  end: 32_000,
  strand: "-",
  featureType: "CDS",
  product: "E2E transposase",
};

export const circularViewerFixture = {
  genomeId,
  accession,
  length,
  forwardFeature,
  customFeature,
};

/**
 * `/api/circular-viewer/*` for `bacterialGenomeRecord`: one 50 kb sequence,
 * one forward CDS over its first half, no other preset features, a custom
 * search that finds one gene, and smooth GC windows. The panel fetches the
 * route from the browser, so these overrides are its whole mock; the
 * loopback only serves the Genome page's own record lookup.
 */
export const circularViewerScenarioOverrides: JsonOverride[] = [
  {
    url: /\/api\/circular-viewer\/contigs(?:\?|$)/,
    method: "GET",
    body: {
      contigs: [
        {
          accession,
          sequenceId: "e2e-seq-1",
          length,
          gcContent: 65.6,
          topology: "circular",
          sequenceType: "chromosome",
        },
      ],
      truncated: false,
    },
  },
  {
    url: /\/api\/circular-viewer\/track(?:\?|$)/,
    method: "GET",
    body: ({ requestUrl }) => ({
      features:
        new URL(requestUrl).searchParams.get("preset") === "cds-forward"
          ? [forwardFeature]
          : [],
      truncated: false,
    }),
  },
  {
    url: /\/api\/circular-viewer\/custom(?:\?|$)/,
    method: "GET",
    body: ({ requestUrl }) => {
      const query = new URL(requestUrl).searchParams;
      const matches =
        query.get("type") === "CDS" &&
        query.get("strand") === "both" &&
        query.get("keyword") === "transposase";
      return { features: matches ? [customFeature] : [], truncated: false };
    },
  },
  {
    url: /\/api\/circular-viewer\/gc(?:\?|$)/,
    method: "GET",
    body: {
      windowSize,
      contigs: [
        {
          accession,
          length,
          gc: Array.from(
            { length: windows },
            (_, index) =>
              Math.round((0.6 + 0.1 * Math.sin(index / 40)) * 10_000) / 10_000,
          ),
          skew: Array.from(
            { length: windows },
            (_, index) => Math.round(0.2 * Math.cos(index / 40) * 10_000) / 10_000,
          ),
        },
      ],
    },
  },
];
