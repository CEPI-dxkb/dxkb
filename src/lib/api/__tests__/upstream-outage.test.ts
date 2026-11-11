import { http, HttpResponse } from "msw";

import {
  fetchUpstream,
  UpstreamError,
  upstreamResponseError,
} from "@/lib/api/upstream-failure";
import { isUpstreamDown, isUpstreamOutageError } from "@/lib/api/upstream-outage";
import { DataApiError, ServerDataRepository } from "@/lib/data-api/repository";
import { createServerDataRepository } from "@/lib/data-api/server-repository";
import { server } from "@/test-helpers/msw-server";
import {
  connectionRefused,
  connectTimeout,
  maintenancePage,
  neverRespond,
  shortenTimeouts,
  undiciFetchFailure,
} from "@/test-helpers/upstream-failures";

const dataService = "the BV-BRC data service";
const taxonomyService = "the BV-BRC taxonomy service";
const genomeUrl = "https://data.test/genome/";
const taxonomyUrl = "https://www.bv-brc.org/api/taxonomy/2";

const budgetMs = 20_000;
/** A load that took half its budget: the slowest a healthy host is assumed to answer. */
const slow = { elapsedMs: budgetMs / 2, budgetMs };
const fast = { elapsedMs: budgetMs / 2 - 1, budgetMs };

/** undici's socket errors for a connection the peer dropped, as `fetch` rejects with them. */
const droppedConnections = [
  ["ECONNRESET", "read ECONNRESET"],
  ["EPIPE", "write EPIPE"],
  ["UND_ERR_SOCKET", "other side closed"],
  ["UND_ERR_CLOSED", "The client is destroyed"],
] as const;

async function dataApiFailure(
  respond: Parameters<typeof http.get>[1],
  options: { baseUrl?: string; token?: string } = {},
): Promise<unknown> {
  server.use(http.get(genomeUrl, respond));
  return new ServerDataRepository({
    baseUrl: options.baseUrl ?? "https://data.test",
    token: options.token,
  })
    .collection("genome", { operation: "collection", rql: "eq(genus,Escherichia)" })
    .catch((error: unknown) => error);
}

async function fetchFailure(respond: Parameters<typeof http.get>[1]): Promise<unknown> {
  server.use(http.get(taxonomyUrl, respond));
  try {
    const response = await fetchUpstream(
      taxonomyUrl,
      {},
      { service: taxonomyService, timeoutMs: 30_000 },
    );
    return await upstreamResponseError(response, taxonomyService);
  } catch (error) {
    return error;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isUpstreamOutageError and isUpstreamDown on a DataApiError", () => {
  it("treat a timeout (504 upstream_timeout) as an outage that trips", async () => {
    shortenTimeouts();
    const error = await dataApiFailure(neverRespond);
    expect(error).toBeInstanceOf(DataApiError);
    expect(error).toMatchObject({ status: 504, code: "upstream_timeout" });
    expect(isUpstreamOutageError(error, dataService)).toBe(true);
    expect(isUpstreamDown(error, dataService)).toBe(true);
    expect(isUpstreamDown(error, dataService, fast)).toBe(true);
  });

  it("treat an unreachable host (502 service_unavailable) as an outage that trips", async () => {
    const error = await dataApiFailure(() => {
      throw connectionRefused();
    });
    expect(error).toMatchObject({ status: 502, code: "service_unavailable" });
    expect(isUpstreamOutageError(error, dataService)).toBe(true);
    expect(isUpstreamDown(error, dataService)).toBe(true);
    expect(isUpstreamDown(error, dataService, fast)).toBe(true);
  });

  it.each(droppedConnections)(
    "trip on a dropped connection (%s) only when it was slow",
    async (code, message) => {
      const error = await dataApiFailure(() => {
        throw undiciFetchFailure(code, message);
      });
      expect(error).toBeInstanceOf(DataApiError);
      expect(error).toMatchObject({ status: 502, code: "service_unavailable" });
      expect(isUpstreamOutageError(error, dataService)).toBe(true);
      expect(isUpstreamDown(error, dataService)).toBe(false);
      expect(isUpstreamDown(error, dataService, fast)).toBe(false);
      expect(isUpstreamDown(error, dataService, slow)).toBe(true);
    },
  );

  it.each([
    [
      "a 504 gateway page",
      () =>
        new HttpResponse("<html><title>504 Gateway Time-out</title></html>", {
          status: 504,
          headers: { "Content-Type": "text/html" },
        }),
    ],
    [
      "a 500 page naming 504",
      () =>
        HttpResponse.json(
          {
            status: 500,
            message:
              "Unable to parse the query response. <html><body><h1>504 Gateway Time-out</h1></body></html>",
          },
          { status: 500 },
        ),
    ],
  ])("treat %s (504 upstream_timeout) as an outage that trips, however fast", async (_label, respond) => {
    const error = await dataApiFailure(respond);
    expect(error).toMatchObject({ status: 504, code: "upstream_timeout" });
    expect(isUpstreamOutageError(error, dataService)).toBe(true);
    expect(isUpstreamDown(error, dataService)).toBe(true);
    expect(isUpstreamDown(error, dataService, fast)).toBe(true);
  });

  it("treat the maintenance page (503 service_unavailable) as an outage that trips", async () => {
    const error = await dataApiFailure(() => maintenancePage());
    expect(error).toMatchObject({ status: 503, code: "service_unavailable" });
    expect(isUpstreamOutageError(error, dataService)).toBe(true);
    expect(isUpstreamDown(error, dataService)).toBe(true);
    expect(isUpstreamDown(error, dataService, fast)).toBe(true);
  });

  it.each([
    [
      "a 500 gateway page",
      () =>
        new HttpResponse("<html><title>Gateway Error</title></html>", {
          status: 500,
          headers: { "Content-Type": "text/html" },
        }),
    ],
    [
      "a 500 JSON error",
      () => HttpResponse.json({ error: { msg: "undefined field genus_x" } }, { status: 500 }),
    ],
    [
      "a 502 gateway page",
      () =>
        new HttpResponse("<html><title>Bad Gateway</title></html>", {
          status: 502,
          headers: { "Content-Type": "text/html" },
        }),
    ],
  ])("cache %s (502 upstream_error), tripping only when it was slow", async (_label, respond) => {
    const error = await dataApiFailure(respond);
    expect(error).toMatchObject({ status: 502, code: "upstream_error" });
    expect(isUpstreamOutageError(error, dataService)).toBe(true);
    expect(isUpstreamDown(error, dataService)).toBe(false);
    expect(isUpstreamDown(error, dataService, fast)).toBe(false);
    expect(isUpstreamDown(error, dataService, slow)).toBe(true);
  });

  it("cache a malformed payload (502 malformed_response), tripping only when it was slow", async () => {
    const error = await dataApiFailure(() => HttpResponse.json({ unexpected: true }));
    expect(error).toMatchObject({ status: 502, code: "malformed_response" });
    expect(isUpstreamOutageError(error, dataService)).toBe(true);
    expect(isUpstreamDown(error, dataService)).toBe(false);
    expect(isUpstreamDown(error, dataService, fast)).toBe(false);
    expect(isUpstreamDown(error, dataService, slow)).toBe(true);
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [429, "rate_limited"],
  ])("leave a %i (%s) alone, however slow", async (status) => {
    const error = await dataApiFailure(() =>
      HttpResponse.json({ error: "no" }, { status }),
    );
    expect(error).toMatchObject({ status });
    expect(isUpstreamOutageError(error, dataService)).toBe(false);
    expect(isUpstreamDown(error, dataService)).toBe(false);
    expect(isUpstreamDown(error, dataService, slow)).toBe(false);
  });

  it("leave an insecure upstream (500 insecure_upstream) alone, however slow", async () => {
    const error = await new ServerDataRepository({
      baseUrl: "http://data.test",
      token: "secret",
    })
      .collection("genome", { operation: "collection" })
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ status: 500, code: "insecure_upstream" });
    expect(isUpstreamOutageError(error, dataService)).toBe(false);
    expect(isUpstreamDown(error, dataService)).toBe(false);
    expect(isUpstreamDown(error, dataService, slow)).toBe(false);
  });

  describe("without a configured data service", () => {
    beforeEach(() => {
      vi.stubEnv("DATA_API_URL", "");
      vi.stubEnv("NEXT_PUBLIC_DATA_API", "");
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("leave not_configured (a 500) alone, however slow", async () => {
      const error = await createServerDataRepository({ readScope: "member" }).catch(
        (caught: unknown) => caught,
      );
      expect(error).toMatchObject({ status: 500, code: "not_configured" });
      expect(isUpstreamOutageError(error, dataService)).toBe(false);
      expect(isUpstreamDown(error, dataService)).toBe(false);
      expect(isUpstreamDown(error, dataService, slow)).toBe(false);
    });
  });
});

describe("isUpstreamOutageError and isUpstreamDown on an UpstreamError", () => {
  it("treat a timeout (504 upstream_timeout) as an outage that trips", async () => {
    shortenTimeouts();
    const error = await fetchFailure(neverRespond);
    expect(error).toBeInstanceOf(UpstreamError);
    expect(error).toMatchObject({ status: 504, code: "upstream_timeout" });
    expect(isUpstreamOutageError(error, taxonomyService)).toBe(true);
    expect(isUpstreamDown(error, taxonomyService)).toBe(true);
    expect(isUpstreamDown(error, taxonomyService, fast)).toBe(true);
  });

  it("treat an unreachable host (502 service_unavailable) as an outage that trips", async () => {
    const error = await fetchFailure(() => {
      throw connectionRefused();
    });
    expect(error).toMatchObject({ status: 502, code: "service_unavailable" });
    expect(isUpstreamOutageError(error, taxonomyService)).toBe(true);
    expect(isUpstreamDown(error, taxonomyService)).toBe(true);
    expect(isUpstreamDown(error, taxonomyService, fast)).toBe(true);
  });

  it.each(droppedConnections)(
    "trip on a dropped connection (%s) only when it was slow",
    async (code, message) => {
      const error = await fetchFailure(() => {
        throw undiciFetchFailure(code, message);
      });
      expect(error).toBeInstanceOf(UpstreamError);
      expect(error).toMatchObject({ status: 502, code: "service_unavailable" });
      expect(isUpstreamOutageError(error, taxonomyService)).toBe(true);
      expect(isUpstreamDown(error, taxonomyService)).toBe(false);
      expect(isUpstreamDown(error, taxonomyService, fast)).toBe(false);
      expect(isUpstreamDown(error, taxonomyService, slow)).toBe(true);
    },
  );

  it.each([
    [503, 503, "service_unavailable"],
    [504, 504, "upstream_timeout"],
  ])("treat an HTTP %i (%i %s) as an outage that trips", async (httpStatus, status, code) => {
    const error = await fetchFailure(() => maintenancePage(httpStatus));
    expect(error).toMatchObject({ status, code });
    expect(isUpstreamOutageError(error, taxonomyService)).toBe(true);
    expect(isUpstreamDown(error, taxonomyService)).toBe(true);
    expect(isUpstreamDown(error, taxonomyService, fast)).toBe(true);
  });

  it.each([500, 502])(
    "cache an HTTP %i (502 upstream_error), tripping only when it was slow",
    async (httpStatus) => {
      const error = await fetchFailure(() => maintenancePage(httpStatus));
      expect(error).toMatchObject({ status: 502, code: "upstream_error" });
      expect(isUpstreamOutageError(error, taxonomyService)).toBe(true);
      expect(isUpstreamDown(error, taxonomyService)).toBe(false);
      expect(isUpstreamDown(error, taxonomyService, fast)).toBe(false);
      expect(isUpstreamDown(error, taxonomyService, slow)).toBe(true);
    },
  );

  it.each([400, 404])("leave an HTTP %i alone, however slow", async (httpStatus) => {
    const error = await fetchFailure(() => HttpResponse.json({}, { status: httpStatus }));
    expect(error).toMatchObject({ status: httpStatus, code: "upstream_error" });
    expect(isUpstreamOutageError(error, taxonomyService)).toBe(false);
    expect(isUpstreamDown(error, taxonomyService)).toBe(false);
    expect(isUpstreamDown(error, taxonomyService, slow)).toBe(false);
  });
});

describe("isUpstreamOutageError and isUpstreamDown on other errors", () => {
  it("treat a raw undici timeout or refused connection as an outage that trips", () => {
    for (const error of [connectTimeout(), connectionRefused()]) {
      expect(isUpstreamOutageError(error, taxonomyService)).toBe(true);
      expect(isUpstreamDown(error, taxonomyService)).toBe(true);
      expect(isUpstreamDown(error, taxonomyService, fast)).toBe(true);
    }
  });

  it.each(droppedConnections)(
    "trip on a raw dropped connection (%s) only when it was slow",
    (code, message) => {
      const error = undiciFetchFailure(code, message);
      expect(isUpstreamOutageError(error, taxonomyService)).toBe(true);
      expect(isUpstreamDown(error, taxonomyService)).toBe(false);
      expect(isUpstreamDown(error, taxonomyService, fast)).toBe(false);
      expect(isUpstreamDown(error, taxonomyService, slow)).toBe(true);
    },
  );

  it("leave a caller's abort, a bug and a non-error alone, however slow", () => {
    const abort = new DOMException("This operation was aborted", "AbortError");
    for (const error of [abort, new TypeError("x is undefined"), new Error("boom"), "boom", null]) {
      expect(isUpstreamOutageError(error, taxonomyService)).toBe(false);
      expect(isUpstreamDown(error, taxonomyService)).toBe(false);
      expect(isUpstreamDown(error, taxonomyService, slow)).toBe(false);
    }
  });
});
