import type { JsonOverride } from "../../mocks/backends";
import {
  buildGatewayCollectionEnvelope,
} from "@/lib/e2e-fixtures/envelopes";
import { genomeFeatureRecord, genomeRecord } from "@/lib/e2e-fixtures/records";

export {
  e2eProteinResidues,
  genomeDownloadTsv,
} from "@/lib/e2e-fixtures/downloads";

export const downloadRoutePattern = /\/api\/data\/[^/?#]+\/download(?:\?|$)/;

/**
 * Lets a download POST through to the real gateway route so the server builds
 * it and the loopback answers from `src/lib/e2e-fixtures/downloads.ts`. The
 * resource bundles do not match this sub-route, so a spec that downloads must
 * include this bundle.
 */
export const downloadGatewayOverrides: JsonOverride[] = [
  { url: downloadRoutePattern, method: "POST", passthrough: true },
];

export function downloadErrorOverride(
  message: string,
  status = 400,
): JsonOverride {
  return {
    url: downloadRoutePattern,
    method: "POST",
    status,
    body: { error: message, code: "invalid_request" },
  };
}

export const downloadGenomeRow = {
  genome_id: genomeRecord.genome_id,
  genome_name: genomeRecord.genome_name,
};

/** Rows only: the facet request falls through to `genomeScenarioOverrides`. */
export function genomeDownloadTotalOverride(total: number): JsonOverride {
  return {
    url: /\/api\/data\/genome(?=\?)(?=[^#]*[?&]operation=collection(?:&|$))(?![^#]*[?&]facet=)/,
    method: "GET",
    body: buildGatewayCollectionEnvelope([genomeRecord], { total }),
  };
}

export const downloadFeatureRows = [
  genomeFeatureRecord,
  {
    ...genomeFeatureRecord,
    feature_id: "PATRIC.1282460.2049.JX869059.CDS.200.300.fwd",
    patric_id: "fig|1282460.2049.peg.2",
    product: "spike protein",
  },
] as const;

export const downloadFeatureCollectionOverride: JsonOverride = {
  url: /\/api\/data\/genome_feature(?=\?)(?=[^#]*[?&]operation=collection(?:&|$))(?![^#]*[?&]facet=)/,
  method: "GET",
  body: buildGatewayCollectionEnvelope([...downloadFeatureRows]),
};
