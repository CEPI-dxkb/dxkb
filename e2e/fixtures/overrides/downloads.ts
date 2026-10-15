import type { JsonOverride } from "../../mocks/backends";
import {
  buildGatewayCollectionEnvelope,
} from "@/lib/e2e-fixtures/envelopes";
import { genomeFeatureRecord, genomeRecord } from "@/lib/e2e-fixtures/records";

export {
  e2eProteinResidues,
  genomeDownloadTsv,
} from "@/lib/e2e-fixtures/downloads";

/** `POST /api/data/<resource>/download`, the table and FASTA download gateway. */
export const downloadRoutePattern = /\/api\/data\/[^/?#]+\/download(?:\?|$)/;

/**
 * Lets a download POST through to the real gateway route rather than
 * fulfilling it here, so a spec downloads what the server builds: the route
 * validates the request, `ServerDataRepository.download()` builds the RQL,
 * and its upstream request reaches the loopback mock, which answers from
 * `src/lib/e2e-fixtures/downloads.ts`. Both transports pass: the buffered
 * `fetch` and the native form POST into a hidden iframe.
 *
 * The strict guard aborts any `/api/**` request no override matches, and the
 * resource scenario bundles (`/\/api\/data\/genome(?:\?|$)/`) deliberately do
 * not match a sub-route, so a spec that downloads includes this bundle.
 */
export const downloadGatewayOverrides: JsonOverride[] = [
  { url: downloadRoutePattern, method: "POST", passthrough: true },
];

/** The gateway refusing a download with `message`, in its `{error, code}` shape. */
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

/** The Genome row the download specs list, select and download. */
export const downloadGenomeRow = {
  genome_id: genomeRecord.genome_id,
  genome_name: genomeRecord.genome_name,
};

/**
 * The Genome list with `total` matching rows and one on the page, so a spec
 * can reach a size limit or the native transport. Rows only: the facet
 * request falls through to `genomeScenarioOverrides`.
 */
export function genomeDownloadTotalOverride(total: number): JsonOverride {
  return {
    url: /\/api\/data\/genome(?=\?)(?=[^#]*[?&]operation=collection(?:&|$))(?![^#]*[?&]facet=)/,
    method: "GET",
    body: buildGatewayCollectionEnvelope([genomeRecord], { total }),
  };
}

/** Two Feature rows, so a spec can select them in an order of its own. */
export const downloadFeatureRows = [
  genomeFeatureRecord,
  {
    ...genomeFeatureRecord,
    feature_id: "PATRIC.1282460.2049.JX869059.CDS.200.300.fwd",
    patric_id: "fig|1282460.2049.peg.2",
    product: "spike protein",
  },
] as const;

/** The Feature list showing {@link downloadFeatureRows}. */
export const downloadFeatureCollectionOverride: JsonOverride = {
  url: /\/api\/data\/genome_feature(?=\?)(?=[^#]*[?&]operation=collection(?:&|$))(?![^#]*[?&]facet=)/,
  method: "GET",
  body: buildGatewayCollectionEnvelope([...downloadFeatureRows]),
};
