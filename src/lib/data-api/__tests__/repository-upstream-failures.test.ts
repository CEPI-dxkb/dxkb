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
        "The BV-BRC data service (data.test) did not respond (connection timed out after 10 s). Please try again.",
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
        "Could not reach the BV-BRC data service (data.test): connection refused. Please try again.",
    });
  });

  it("gives up after its own budget when the upstream never answers", async () => {
    shortenTimeouts();
    server.use(http.get(genomeUrl, neverRespond));

    await expect(readCollection()).rejects.toMatchObject({
      status: 504,
      code: "upstream_timeout",
      message:
        "The BV-BRC data service (data.test) did not respond (timed out after 20 s). Please try again.",
    });
  });

  it("summarizes a fast 503 maintenance page instead of forwarding its HTML", async () => {
    server.use(http.get(genomeUrl, () => maintenancePage()));

    const error = await readCollection().catch((caught: unknown) => caught);
    expect(error).toMatchObject({
      status: 503,
      code: "service_unavailable",
      message: `The data service is temporarily unavailable (${maintenanceSummary}). Please try again.`,
    });
    expect((error as Error).message).not.toContain("<");
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
    expect((error as Error).message).toMatch(/soon\)\. Please try again\.$/);
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
        "The BV-BRC data service (data.test) did not respond (connection timed out after 10 s). Please try again.",
      code: "upstream_timeout",
    });
  });
});
