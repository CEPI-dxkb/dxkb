import type { JsonOverride } from "../../mocks/backends";
import {
  genomeFeatureRecord,
  genomeSequenceRecord,
} from "@/lib/e2e-fixtures/records";

const sequence = "ACGT".repeat(Math.ceil(genomeSequenceRecord.length / 4)).slice(
  0,
  genomeSequenceRecord.length,
);

const patricFeature = {
  uniqueId: genomeFeatureRecord.feature_id,
  refName: genomeFeatureRecord.accession,
  start: genomeFeatureRecord.start - 1,
  end: genomeFeatureRecord.end,
  strand: 1,
  type: genomeFeatureRecord.feature_type,
  name: genomeFeatureRecord.patric_id,
  feature_id: genomeFeatureRecord.feature_id,
  patric_id: genomeFeatureRecord.patric_id,
  product: genomeFeatureRecord.product,
};

function span(requestUrl: string) {
  const params = new URL(requestUrl).searchParams;
  return {
    params,
    start: Number(params.get("start")),
    end: Number(params.get("end")),
  };
}

/**
 * `/api/genome-browser/*` for the MERS fixture genome: one 30,119 bp sequence,
 * one PATRIC CDS at 1..100, no RefSeq features, and a deterministic sequence
 * so a zoomed-in spec can read bases.
 */
export const genomeBrowserScenarioOverrides: JsonOverride[] = [
  {
    url: /\/api\/genome-browser\/regions(?:\?|$)/,
    method: "GET",
    body: {
      regions: [
        {
          refName: genomeSequenceRecord.accession,
          start: 0,
          end: genomeSequenceRecord.length,
        },
      ],
    },
  },
  {
    url: /\/api\/genome-browser\/features(?:\?|$)/,
    method: "GET",
    body: ({ requestUrl }) => {
      const { params, start, end } = span(requestUrl);
      const patric = params.get("annotation") === "PATRIC";
      const overlaps = patricFeature.start < end && patricFeature.end > start;
      return {
        features: patric && overlaps ? [patricFeature] : [],
        truncated: false,
      };
    },
  },
  {
    url: /\/api\/genome-browser\/sequence(?:\?|$)/,
    method: "GET",
    body: ({ requestUrl }) => {
      const { start, end } = span(requestUrl);
      const stop = Math.min(end, sequence.length);
      return { start, end: stop, seq: sequence.slice(start, stop) };
    },
  },
];
