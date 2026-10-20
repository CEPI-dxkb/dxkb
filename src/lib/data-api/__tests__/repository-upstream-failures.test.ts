import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import {
  connectionRefused,
  connectTimeout,
  maintenancePage,
  maintenanceSummary,
  neverRespond,
  shortenTimeouts,
} from "@/test-helpers/upstream-failures";
import { DataApiError, ServerDataRepository } from "../repository";
import { dataApiErrorResponse } from "../route-errors";

const genomeUrl = "https://data.test/genome/";

function readCollection(signal?: AbortSignal) {
  return new ServerDataRepository({ baseUrl: "https://data.test" }).collection(
    "genome",
    { operation: "collection", rql: "eq(genus,Escherichia)" },
    signal,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ServerDataRepository upstream failures", () => {
  it("reports a connect timeout as a 504 naming the data service", async () => {
    server.use(
      http.get(genomeUrl, () => {
        throw connectTimeout();
      }),
    );

    const failure = readCollection();
    await expect(failure).rejects.toBeInstanceOf(DataApiError);
    await expect(failure).rejects.toMatchObject({
      status: 504,
      code: "upstream_timeout",
      message:
        "The BV-BRC data service did not respond (connection timed out after 10 s).",
    });
  });

  it("reports a refused connection as a 502", async () => {
    server.use(
      http.get(genomeUrl, () => {
        throw connectionRefused();
      }),
    );

    await expect(readCollection()).rejects.toMatchObject({
      status: 502,
      code: "service_unavailable",
      message:
        "Could not reach the BV-BRC data service: connection refused.",
    });
  });

  it("gives up after its own budget when the upstream never answers", async () => {
    shortenTimeouts();
    server.use(http.get(genomeUrl, neverRespond));

    await expect(readCollection()).rejects.toMatchObject({
      status: 504,
      code: "upstream_timeout",
      message:
        "The BV-BRC data service did not respond (timed out after 20 s).",
    });
  });

  it("gives AMR phenotype reads their longer budget", async () => {
    // A taxon AMR tab's cold genome(...) join outlasts the shared 20 s.
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    shortenTimeouts();
    server.use(http.get("https://data.test/genome_amr/", neverRespond));

    await expect(
      new ServerDataRepository({ baseUrl: "https://data.test" }).collection(
        "genome_amr",
        {
          operation: "collection",
          rql: "and(eq(genome_id,*),genome(eq(taxon_lineage_ids,2)))",
        },
      ),
    ).rejects.toMatchObject({
      status: 504,
      code: "upstream_timeout",
      message:
        "The BV-BRC data service did not respond (timed out after 60 s).",
    });
    expect(timeoutSpy).toHaveBeenCalledWith(60_000);
    expect(timeoutSpy).not.toHaveBeenCalledWith(20_000);
  });

  it("summarizes a fast 503 maintenance page instead of forwarding its HTML", async () => {
    server.use(http.get(genomeUrl, () => maintenancePage()));

    const error = await readCollection().catch((caught: unknown) => caught);
    expect(error).toMatchObject({
      status: 503,
      code: "service_unavailable",
      message: `The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: ${maintenanceSummary}).`,
    });
    expect((error as Error).message).not.toContain("<");
  });

  it.each([
    [502, "Bad Gateway"],
    [500, "Internal Server Error"],
  ])(
    "phrases a %i gateway page as every backend's outage does",
    async (status, statusText) => {
      server.use(
        http.get(
          genomeUrl,
          () =>
            new HttpResponse("<html><title>Gateway Error</title></html>", {
              status,
              statusText,
              headers: { "Content-Type": "text/html" },
            }),
        ),
      );

      await expect(readCollection()).rejects.toMatchObject({
        status: 502,
        code: "upstream_error",
        message: `The BV-BRC data service is unavailable (HTTP ${String(status)} ${statusText}: Gateway Error).`,
      });
    },
  );

  it("names the status of an outage whose body is empty or plain text, without reading the text", async () => {
    server.use(
      http.get(
        genomeUrl,
        () =>
          new HttpResponse("java.lang.OutOfMemoryError at solr.internal:8983", {
            status: 500,
            statusText: "Internal Server Error",
          }),
      ),
    );

    const error = await readCollection().catch((caught: unknown) => caught);
    expect(error).toMatchObject({
      status: 502,
      code: "upstream_error",
      message:
        "The BV-BRC data service is unavailable (HTTP 500 Internal Server Error).",
    });
    expect((error as Error).message).not.toContain("solr.internal");
  });

  it("keeps the service's own JSON error for a 5xx that is not an outage", async () => {
    server.use(
      http.get(genomeUrl, () =>
        HttpResponse.json(
          { error: { msg: "undefined field genus_x" } },
          { status: 500, statusText: "Internal Server Error" },
        ),
      ),
    );

    await expect(readCollection()).rejects.toMatchObject({
      status: 502,
      code: "upstream_error",
      message: "undefined field genus_x",
    });
  });

  it("keeps the failed host on the cause, for the route's log", async () => {
    server.use(
      http.get(genomeUrl, () => {
        throw connectionRefused();
      }),
    );

    const error = await readCollection().catch((caught: unknown) => caught);
    expect((error as Error).message).not.toContain("data.test");
    expect((error as Error).cause).toMatchObject({ host: "data.test" });
  });

  it("does not double the punctuation when the page's text ends a sentence", async () => {
    server.use(
      http.get(
        genomeUrl,
        () =>
          new HttpResponse(
            "<!doctype html><title>Site Maintenance</title><h1>Service will be back soon.</h1>",
            {
              status: 503,
              statusText: "Service Unavailable",
              headers: { "Content-Type": "text/html" },
            },
          ),
      ),
    );

    const error = await readCollection().catch((caught: unknown) => caught);
    expect((error as Error).message).toMatch(/soon\)\.$/);
    expect((error as Error).message).not.toContain(".).");
  });

  it("keeps a caller's abort as an AbortError for the route's 499", async () => {
    server.use(http.get(genomeUrl, neverRespond));
    const controller = new AbortController();
    const pending = readCollection(controller.signal);
    controller.abort();

    const error = await pending.catch((caught: unknown) => caught);
    expect(error).not.toBeInstanceOf(DataApiError);
    expect(error).toMatchObject({ name: "AbortError" });
    expect(dataApiErrorResponse(error).status).toBe(499);
  });

  it("answers the route contract with the timeout's status and code", async () => {
    server.use(
      http.get(genomeUrl, () => {
        throw connectTimeout();
      }),
    );

    const response = dataApiErrorResponse(
      await readCollection().catch((caught: unknown) => caught),
    );
    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({
      error:
        "The BV-BRC data service did not respond (connection timed out after 10 s).",
      code: "upstream_timeout",
    });
  });
});
