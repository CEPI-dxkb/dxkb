import { delay, http, HttpResponse } from "msw";

import { fetchOrganismGenera } from "@/lib/services/organisms/genera";
import { fetchReferenceGenomes } from "@/lib/services/organisms/reference-genomes";
import { fetchOrganismSummary } from "@/lib/services/organisms/summary";
import { fetchOrganismTaxonomy } from "@/lib/services/organisms/taxonomy";
import {
  fetchOrganismSolrJson,
  fetchOrganismSolrJsonPost,
  organismFetchTimeoutMs,
  readJsonObject,
} from "@/lib/services/organisms/utils";
import { UpstreamError } from "@/lib/api/upstream-failure";
import { server } from "@/test-helpers/msw-server";
import {
  connectionRefused,
  connectTimeout,
} from "@/test-helpers/upstream-failures";

const baseUrl = "https://bvbrc.test/api-for-website";
const realTimeout = AbortSignal.timeout.bind(AbortSignal);

function timeoutMessage(label?: string): string {
  const message = `The BV-BRC data service did not respond (timed out after ${String(organismFetchTimeoutMs / 1000)} s).`;
  return label ? `${label}: ${message}` : message;
}

const genusFacet = { source: "genome genus facet", label: "Genus" };
const amrPivot = { source: "genome_amr phenotype pivot", label: "Antimicrobial Resistance Profile" };

function stallEveryRequest() {
  server.use(
    http.all(`${baseUrl}/*`, async () => {
      await delay("infinite");
      return HttpResponse.json({});
    }),
  );
}

beforeEach(() => {
  process.env.BVBRC_WEBSITE_API_URL = baseUrl;
  // Keep the production budget in the message but let the signal fire fast.
  vi.spyOn(AbortSignal, "timeout").mockImplementation(() => realTimeout(20));
});

afterEach(() => {
  delete process.env.BVBRC_WEBSITE_API_URL;
  vi.restoreAllMocks();
});

describe("organism fetch timeout", () => {
  // A loader whose card names its section ("Data summary could not be
  // loaded") leaves the label out; the endpoint is only for the log.
  it.each([
    ["fetchOrganismSolrJson", genusFacet, () =>
      fetchOrganismSolrJson(`${baseUrl}/genome/`, genusFacet)],
    ["fetchOrganismSolrJsonPost", amrPivot, () =>
      fetchOrganismSolrJsonPost(`${baseUrl}/genome_amr/`, "eq(genome_id,*)", amrPivot)],
    ["fetchOrganismSummary", { source: "summary_by_taxon" }, () => fetchOrganismSummary(10239)],
    ["fetchOrganismTaxonomy", { source: "taxonomy/10239" }, () => fetchOrganismTaxonomy(10239)],
    ["fetchOrganismGenera", { source: "genome genus facet" }, () => fetchOrganismGenera(2)],
    ["fetchReferenceGenomes", { source: "reference-genomes" }, () => fetchReferenceGenomes(2)],
  ] as const)(
    "%s names the budget, behind its label, when upstream never responds",
    async (_name, request, load) => {
      stallEveryRequest();

      await expect(load()).rejects.toMatchObject({
        message: timeoutMessage("label" in request ? request.label : undefined),
        source: request.source,
      });
    },
  );

  // MSW does not tie the request signal to a mocked body, so reproduce what
  // undici does on a mid-body abort: error the stream with the signal reason.
  function abortedBody(error: Error): Response {
    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"count":'));
          controller.error(error);
        },
      }),
    );
  }

  it("reports a body that times out as a timeout, not malformed JSON", async () => {
    const timeout = new DOMException("The operation was aborted due to timeout", "TimeoutError");

    await expect(readJsonObject(abortedBody(timeout), genusFacet)).rejects.toThrow(
      timeoutMessage("Genus"),
    );
  });

  it("passes a caller abort during the body through untouched", async () => {
    const abort = new DOMException("caller cancelled", "AbortError");

    await expect(readJsonObject(abortedBody(abort), genusFacet)).rejects.toBe(abort);
  });

  it("still lets the caller's signal cancel a request in flight", async () => {
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() => realTimeout(60_000));
    stallEveryRequest();
    const controller = new AbortController();

    const pending = fetchOrganismSolrJson(`${baseUrl}/genome/`, genusFacet, controller.signal);
    controller.abort(new Error("caller cancelled"));

    await expect(pending).rejects.toThrow("caller cancelled");
  });

  it.each([
    ["fetchOrganismSolrJson", "Genus: ", () =>
      fetchOrganismSolrJson(`${baseUrl}/genome/`, genusFacet)],
    ["fetchOrganismSolrJsonPost", "Antimicrobial Resistance Profile: ", () =>
      fetchOrganismSolrJsonPost(`${baseUrl}/genome_amr/`, "eq(genome_id,*)", amrPivot)],
    ["fetchOrganismSummary", "", () => fetchOrganismSummary(10239)],
    ["fetchOrganismGenera", "", () => fetchOrganismGenera(2)],
  ] as const)(
    "%s says the data service did not respond when the connect times out, not \"fetch failed\"",
    async (_name, prefix, load) => {
      server.use(
        http.all(`${baseUrl}/*`, () => {
          throw connectTimeout();
        }),
      );

      const error: unknown = await load().catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(UpstreamError);
      // The host is for the server log, never the message.
      expect(error).toMatchObject({
        status: 504,
        code: "upstream_timeout",
        message: `${prefix}The BV-BRC data service did not respond (connection timed out after 10 s).`,
        host: "bvbrc.test",
      });
    },
  );

  it("says the data service could not be reached when the connection is refused", async () => {
    server.use(
      http.all(`${baseUrl}/*`, () => {
        throw connectionRefused();
      }),
    );

    await expect(fetchOrganismSummary(10239)).rejects.toMatchObject({
      status: 502,
      code: "service_unavailable",
      message: "Could not reach the BV-BRC data service: connection refused.",
      host: "bvbrc.test",
      source: "summary_by_taxon",
    });
  });
});
