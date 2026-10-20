import { http, HttpResponse } from "msw";

import {
  describeUpstreamFailure,
  describeUpstreamResponse,
  fetchUpstream,
  summarizeUpstreamBody,
  UpstreamError,
  upstreamResponseError,
  upstreamTimeoutFailure,
} from "@/lib/api/upstream-failure";
import { server } from "@/test-helpers/msw-server";
import {
  connectionRefused,
  connectTimeout,
  maintenancePage,
  maintenancePageHtml,
  maintenanceSummary,
  neverRespond,
  shortenTimeouts,
  undiciFetchFailure,
} from "@/test-helpers/upstream-failures";

const service = "the BV-BRC workspace service";
const url = "https://p3.theseed.org/services/Workspace";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("describeUpstreamFailure", () => {
  it("names the service and connect budget, keeping the host out of the message", () => {
    expect(
      describeUpstreamFailure(connectTimeout(), service, { host: "p3.theseed.org" }),
    ).toEqual({
      status: 504,
      code: "upstream_timeout",
      message:
        "The BV-BRC workspace service did not respond (connection timed out after 10 s).",
      host: "p3.theseed.org",
    });
  });

  it("leaves `host` off a failure whose host is unknown", () => {
    const failure = describeUpstreamFailure(connectTimeout(), service);
    expect(failure).not.toHaveProperty("host");
  });

  it("keeps an UpstreamError's host when describing it again", () => {
    const error = new UpstreamError({
      status: 502,
      code: "service_unavailable",
      message: "Could not reach the BV-BRC workspace service: connection refused.",
      host: "p3.theseed.org",
    });
    expect(describeUpstreamFailure(error, "another service")).toEqual({
      status: 502,
      code: "service_unavailable",
      message: "Could not reach the BV-BRC workspace service: connection refused.",
      host: "p3.theseed.org",
    });
  });

  it("carries a request's source for the log, never in the message", () => {
    const error = new UpstreamError({
      status: 503,
      code: "service_unavailable",
      message: "The BV-BRC data service is unavailable (HTTP 503 Service Unavailable).",
      source: "genome genus facet",
    });
    // An own field, so `console.error(error)` prints it.
    expect(Object.keys(error)).toContain("source");
    expect(error.source).toBe("genome genus facet");
    expect(error.message).not.toContain("genus");
    expect(
      new UpstreamError({ status: 502, code: "upstream_error", message: "x" }),
    ).not.toHaveProperty("source");
  });

  it("maps a headers timeout to 504", () => {
    expect(
      describeUpstreamFailure(
        undiciFetchFailure("UND_ERR_HEADERS_TIMEOUT", "Headers Timeout Error"),
        service,
      ),
    ).toMatchObject({
      status: 504,
      code: "upstream_timeout",
      message: "The BV-BRC workspace service did not respond (timed out).",
    });
  });

  it("names the budget of an AbortSignal.timeout", () => {
    const timeout = new DOMException("The operation was aborted due to timeout", "TimeoutError");
    expect(describeUpstreamFailure(timeout, service, { timeoutMs: 30_000 })).toEqual({
      status: 504,
      code: "upstream_timeout",
      message: "The BV-BRC workspace service did not respond (timed out after 30 s).",
    });
  });

  it.each([
    ["ECONNREFUSED", "connection refused"],
    ["ENOTFOUND", "host not found"],
    ["ECONNRESET", "connection reset"],
  ])("maps %s to 502 'Could not reach'", (code, reason) => {
    expect(
      describeUpstreamFailure(undiciFetchFailure(code, `connect ${code}`), service, {
        host: "p3.theseed.org",
      }),
    ).toEqual({
      status: 502,
      code: "service_unavailable",
      message: `Could not reach the BV-BRC workspace service: ${reason}.`,
      host: "p3.theseed.org",
    });
  });

  it("reads the code of a dual-stack AggregateError cause", () => {
    const aggregate = Object.assign(
      new AggregateError([Object.assign(new Error("connect ECONNREFUSED ::1:443"), { code: "ECONNREFUSED" })]),
      {},
    );
    const error = new TypeError("fetch failed", { cause: aggregate });
    expect(describeUpstreamFailure(error, service)?.message).toBe(
      "Could not reach the BV-BRC workspace service: connection refused.",
    );
  });

  it("keeps the innermost message of an unrecognized fetch failure", () => {
    const error = undiciFetchFailure(
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      "unable to verify the first certificate",
    );
    expect(describeUpstreamFailure(error, service)).toEqual({
      status: 502,
      code: "service_unavailable",
      message:
        "Could not reach the BV-BRC workspace service: unable to verify the first certificate.",
    });
  });

  it("leaves a caller's AbortError and application errors to the caller", () => {
    expect(
      describeUpstreamFailure(new DOMException("aborted", "AbortError"), service),
    ).toBeNull();
    expect(describeUpstreamFailure(new Error("method is required"), service)).toBeNull();
    expect(describeUpstreamFailure("boom", service)).toBeNull();
  });

  it("passes an UpstreamError through unchanged", () => {
    const error = new UpstreamError({
      status: 504,
      code: "upstream_timeout",
      message: "The BV-BRC job service did not respond.",
    });
    expect(describeUpstreamFailure(error, service)).toEqual({
      status: 504,
      code: "upstream_timeout",
      message: "The BV-BRC job service did not respond.",
    });
  });
});

describe("summarizeUpstreamBody", () => {
  it("keeps only the title and heading of an HTML page", () => {
    expect(summarizeUpstreamBody(maintenancePageHtml, "text/html")).toBe(maintenanceSummary);
  });

  it("detects HTML by its leading tag without a content type", () => {
    const summary = summarizeUpstreamBody(maintenancePageHtml);
    expect(summary).toBe(maintenanceSummary);
    expect(summary).not.toContain("<");
  });

  it("falls back to the visible text of HTML with no title or heading", () => {
    expect(
      summarizeUpstreamBody(
        "<html><head><style>p{color:red}</style></head><body><p>Bad   gateway</p></body></html>",
      ),
    ).toBe("Bad gateway");
  });

  it("reads a JSON error message", () => {
    expect(summarizeUpstreamBody('{"error":{"message":"_ERROR_Object not found!_"}}')).toBe(
      "_ERROR_Object not found!_",
    );
    expect(summarizeUpstreamBody('{"error":"Rate limit"}')).toBe("Rate limit");
  });

  it("condenses long text", () => {
    const summary = summarizeUpstreamBody("x".repeat(500));
    expect(summary.length).toBeLessThanOrEqual(201);
    expect(summary.endsWith("…")).toBe(true);
  });

  it("is empty for an empty body", () => {
    expect(summarizeUpstreamBody("  ")).toBe("");
  });
});

describe("describeUpstreamResponse", () => {
  it("describes a 503 maintenance page without markup", () => {
    expect(
      describeUpstreamResponse(
        {
          status: 503,
          statusText: "Service Unavailable",
          headers: new Headers({ "Content-Type": "text/html" }),
        },
        maintenancePageHtml,
        service,
      ),
    ).toEqual({
      status: 503,
      code: "service_unavailable",
      message: `The BV-BRC workspace service is unavailable (HTTP 503 Service Unavailable: ${maintenanceSummary}).`,
    });
  });

  it("keeps a given host for logs, out of the message", () => {
    expect(
      describeUpstreamResponse(
        { status: 503, statusText: "Service Unavailable" },
        "",
        service,
        { host: "p3.theseed.org" },
      ),
    ).toEqual({
      status: 503,
      code: "service_unavailable",
      message:
        "The BV-BRC workspace service is unavailable (HTTP 503 Service Unavailable).",
      host: "p3.theseed.org",
    });
  });

  it("does not double the punctuation when the page's text ends a sentence", () => {
    const { message } = describeUpstreamResponse(
      {
        status: 503,
        statusText: "Service Unavailable",
        headers: new Headers({ "Content-Type": "text/html" }),
      },
      "<!doctype html><title>Site Maintenance</title><h1>Service will be back soon.</h1>",
      service,
    );
    expect(message).toMatch(/soon\)\.$/);
    expect(message).not.toContain(".).");
  });

  it("maps 504 to upstream_timeout and other 5xx to 502", () => {
    expect(describeUpstreamResponse({ status: 504 }, "", service)).toMatchObject({
      status: 504,
      code: "upstream_timeout",
    });
    expect(describeUpstreamResponse({ status: 500, statusText: "Internal Server Error" }, "", service)).toEqual({
      status: 502,
      code: "upstream_error",
      message: "The BV-BRC workspace service is unavailable (HTTP 500 Internal Server Error).",
    });
  });

  it("keeps a 4xx status", () => {
    expect(
      describeUpstreamResponse({ status: 404, statusText: "Not Found" }, "no such object", service),
    ).toEqual({
      status: 404,
      code: "upstream_error",
      message: "The BV-BRC workspace service rejected the request (HTTP 404 Not Found: no such object).",
    });
  });
});

describe("fetchUpstream", () => {
  const options = { service, timeoutMs: 30_000 };

  it("returns the response, OK or not", async () => {
    server.use(http.post(url, () => maintenancePage()));
    const response = await fetchUpstream(url, { method: "POST" }, options);
    expect(response.status).toBe(503);
    const error = await upstreamResponseError(response, service);
    expect(error).toMatchObject({
      status: 503,
      code: "service_unavailable",
      message: `The BV-BRC workspace service is unavailable (HTTP 503 Service Unavailable: ${maintenanceSummary}).`,
      host: "p3.theseed.org",
    });
    expect(error.message).not.toContain("p3.theseed.org");
  });

  it("throws UpstreamError with the cause for a connect timeout", async () => {
    server.use(
      http.post(url, () => {
        throw connectTimeout();
      }),
    );
    const failure = fetchUpstream(url, { method: "POST" }, options);
    await expect(failure).rejects.toBeInstanceOf(UpstreamError);
    await expect(failure).rejects.toMatchObject({
      status: 504,
      code: "upstream_timeout",
      message:
        "The BV-BRC workspace service did not respond (connection timed out after 10 s).",
      host: "p3.theseed.org",
      cause: expect.objectContaining({ message: "fetch failed" }) as unknown,
    });
  });

  it("prints the host when the error is logged, for an operator", async () => {
    server.use(
      http.post(url, () => {
        throw connectionRefused();
      }),
    );
    const error = await fetchUpstream(url, { method: "POST" }, options).catch(
      (caught: unknown) => caught,
    );
    const { inspect } = await import("node:util");
    expect(inspect(error)).toContain("host: 'p3.theseed.org'");
    expect((error as Error).message).not.toContain("p3.theseed.org");
  });

  it("throws 502 for a refused connection", async () => {
    server.use(
      http.post(url, () => {
        throw connectionRefused();
      }),
    );
    await expect(fetchUpstream(url, { method: "POST" }, options)).rejects.toMatchObject({
      status: 502,
      message: "Could not reach the BV-BRC workspace service: connection refused.",
    });
  });

  it("maps MSW's plain network error to 502", async () => {
    server.use(http.post(url, () => HttpResponse.error()));
    await expect(fetchUpstream(url, { method: "POST" }, options)).rejects.toMatchObject({
      status: 502,
      code: "service_unavailable",
    });
  });

  it("gives up after the budget when the service never answers", async () => {
    shortenTimeouts();
    server.use(http.post(url, neverRespond));
    await expect(fetchUpstream(url, { method: "POST" }, options)).rejects.toMatchObject({
      status: 504,
      code: "upstream_timeout",
      message: "The BV-BRC workspace service did not respond (timed out after 30 s).",
    });
  });

  it("rethrows the caller's own abort untouched", async () => {
    server.use(http.post(url, neverRespond));
    const controller = new AbortController();
    const pending = fetchUpstream(url, { method: "POST", signal: controller.signal }, options);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await expect(pending).rejects.not.toBeInstanceOf(UpstreamError);
  });

  // MSW does not tie the request signal to a mocked body, so watch the signal
  // the body would be read under (undici errors the stream when it aborts).
  async function signalAfterBudget(streamBody: boolean): Promise<AbortSignal> {
    shortenTimeouts(10);
    let seen: AbortSignal | undefined;
    const fetcher = (_input: RequestInfo | URL, init?: RequestInit) => {
      seen = init?.signal ?? undefined;
      return Promise.resolve(new Response("body"));
    };
    await fetchUpstream(url, {}, { ...options, streamBody, fetcher });
    await new Promise((resolve) => setTimeout(resolve, 40));
    if (!seen) throw new Error("fetcher was not called");
    return seen;
  }

  it("bounds the body read too by default", async () => {
    expect((await signalAfterBudget(false)).aborted).toBe(true);
  });

  it("stops the budget at the headers for a streamed body", async () => {
    expect((await signalAfterBudget(true)).aborted).toBe(false);
  });
});

describe("upstreamTimeoutFailure", () => {
  it("names the service and budget, never the host", () => {
    expect(
      upstreamTimeoutFailure("the BV-BRC profile service", {
        timeoutMs: 15_000,
        host: "user.bv-brc.org",
      }),
    ).toEqual({
      status: 504,
      code: "upstream_timeout",
      message: "The BV-BRC profile service did not respond (timed out after 15 s).",
      host: "user.bv-brc.org",
    });
  });
});
