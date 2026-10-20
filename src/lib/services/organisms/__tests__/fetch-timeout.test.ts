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

function timeoutMessage(source: string, host = " (bvbrc.test)"): string {
  return `${source}: The BV-BRC data service${host} did not respond (timed out after ${String(organismFetchTimeoutMs / 1000)} s).`;
}

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
  it.each([
    ["fetchOrganismSolrJson", "genome genus facet", () =>
      fetchOrganismSolrJson(`${baseUrl}/genome/`, "genome genus facet")],
    ["fetchOrganismSolrJsonPost", "genome_amr", () =>
      fetchOrganismSolrJsonPost(`${baseUrl}/genome_amr/`, "eq(genome_id,*)", "genome_amr")],
    ["fetchOrganismSummary", "summary_by_taxon", () => fetchOrganismSummary(10239)],
    ["fetchOrganismTaxonomy", "taxonomy/10239", () => fetchOrganismTaxonomy(10239)],
    ["fetchOrganismGenera", "genome genus facet", () => fetchOrganismGenera(2)],
    ["fetchReferenceGenomes", "reference-genomes", () => fetchReferenceGenomes(2)],
  ] as const)(
    "%s names the endpoint and budget when upstream never responds",
    async (_name, source, load) => {
      stallEveryRequest();

      await expect(load()).rejects.toThrow(timeoutMessage(source));
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

    // A constructed Response has no URL, so there is no host to name.
    await expect(readJsonObject(abortedBody(timeout), "genome genus facet")).rejects.toThrow(
      timeoutMessage("genome genus facet", ""),
    );
  });

  it("passes a caller abort during the body through untouched", async () => {
    const abort = new DOMException("caller cancelled", "AbortError");

    await expect(readJsonObject(abortedBody(abort), "genome genus facet")).rejects.toBe(abort);
  });

  it("still lets the caller's signal cancel a request in flight", async () => {
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() => realTimeout(60_000));
    stallEveryRequest();
    const controller = new AbortController();

    const pending = fetchOrganismSolrJson(`${baseUrl}/genome/`, "genome genus facet", controller.signal);
    controller.abort(new Error("caller cancelled"));

    await expect(pending).rejects.toThrow("caller cancelled");
  });

  it.each([
    ["fetchOrganismSolrJson", "genome genus facet", () =>
      fetchOrganismSolrJson(`${baseUrl}/genome/`, "genome genus facet")],
    ["fetchOrganismSolrJsonPost", "genome_amr", () =>
      fetchOrganismSolrJsonPost(`${baseUrl}/genome_amr/`, "eq(genome_id,*)", "genome_amr")],
    ["fetchOrganismSummary", "summary_by_taxon", () => fetchOrganismSummary(10239)],
    ["fetchOrganismGenera", "genome genus facet", () => fetchOrganismGenera(2)],
  ] as const)(
    "%s says the data service did not respond when the connect times out, not \"fetch failed\"",
    async (_name, source, load) => {
      server.use(
        http.all(`${baseUrl}/*`, () => {
          throw connectTimeout();
        }),
      );

      const error: unknown = await load().catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(UpstreamError);
      expect(error).toMatchObject({
        status: 504,
        code: "upstream_timeout",
        message: `${source}: The BV-BRC data service (bvbrc.test) did not respond (connection timed out after 10 s).`,
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
      message:
        "summary_by_taxon: Could not reach the BV-BRC data service (bvbrc.test): connection refused.",
    });
  });
});
