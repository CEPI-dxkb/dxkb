import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test-helpers/msw-server";
import { DataRepository, DataRepositoryError } from "../client";

afterEach(() => {
  vi.useRealTimers();
});

interface GatewayRequest {
  request: Request;
  body: string;
}

/**
 * Answer the gateway's `method` requests for `path` with `respond(hit)`, where
 * `hit` counts from 1, recording each request and its body.
 */
function captureGateway(
  method: "get" | "post",
  path: string,
  respond: (hit: number) => Response,
): GatewayRequest[] {
  const requested: GatewayRequest[] = [];
  server.use(
    http[method](path, async ({ request }) => {
      requested.push({ request, body: await request.text() });
      return respond(requested.length);
    }),
  );
  return requested;
}

const rateLimited = () =>
  HttpResponse.json(
    { error: "Too many requests", code: "rate_limited" },
    { status: 429 },
  );

describe("DataRepository", () => {
  it("uses the same-origin gateway and forwards abort signals", async () => {
    const requested = captureGateway("get", "/api/data/genome", () =>
      HttpResponse.json({
        rows: [],
        total: 0,
        facets: {},
        page: 2,
        pageSize: 200,
      }),
    );
    const controller = new AbortController();

    await new DataRepository().collection(
      "genome",
      {
        page: 2,
        sort: { field: "genome_name", direction: "desc" },
        fields: ["genome_id"],
      },
      controller.signal,
    );
    // The Request's signal follows the caller's, so aborting it now shows the
    // two are linked.
    controller.abort();

    expect(requested).toHaveLength(1);
    const { request } = requested[0];
    const url = new URL(request.url);
    expect(url.origin).toBe(window.location.origin);
    expect(`${url.pathname}${url.search}`).toBe(
      "/api/data/genome?operation=collection&page=2&sort=genome_name%3Adesc&field=genome_id",
    );
    expect(request.credentials).toBe("include");
    expect(request.signal.aborted).toBe(true);
  });

  it("sends a sort's tie-breaking keys after its first", async () => {
    const requested = captureGateway("get", "/api/data/genome_feature", () =>
      HttpResponse.json({
        rows: [],
        total: 0,
        facets: {},
        page: 1,
        pageSize: 200,
      }),
    );

    await new DataRepository().collection("genome_feature", {
      sort: {
        field: "genome_name",
        direction: "asc",
        then: [
          { field: "accession", direction: "asc" },
          { field: "start", direction: "desc" },
        ],
      },
    });

    expect(requested).toHaveLength(1);
    expect(
      Object.fromEntries(new URL(requested[0].request.url).searchParams),
    ).toEqual({
      operation: "collection",
      sort: "genome_name:asc,accession:asc,start:desc",
    });
  });

  it("uses POST for selected rows", async () => {
    const requested = captureGateway("post", "/api/data/genome", () =>
      HttpResponse.json({ rows: [] }),
    );

    await new DataRepository().selected("genome", { ids: ["1.1"] });

    expect(requested).toHaveLength(1);
    expect(requested[0].body).toBe(
      JSON.stringify({ operation: "selected", ids: ["1.1"] }),
    );
  });

  it("exports at most the server's aggregate row limit", async () => {
    const rows = Array.from({ length: 10_000 }, (_, index) => ({
      genome_id: String(index),
    }));
    const requested = captureGateway("post", "/api/data/genome", () =>
      HttpResponse.json({ rows }),
    );

    await expect(
      new DataRepository().exportAll("genome", { fields: ["genome_id"] }),
    ).resolves.toEqual({ rows });
    expect(requested).toHaveLength(1);
    expect(requested[0].body).toBe(
      JSON.stringify({
        operation: "export",
        fields: ["genome_id"],
        limit: 10_000,
        offset: 0,
      }),
    );
  });

  it("retries the bounded export after the gateway rate limit resets", async () => {
    vi.useFakeTimers();
    const requested = captureGateway("post", "/api/data/genome", (hit) =>
      hit === 1
        ? HttpResponse.json(
            { error: "Too many requests", code: "rate_limited" },
            { status: 429, headers: { "Retry-After": "1" } },
          )
        : HttpResponse.json({ rows: [{ genome_id: "1" }] }),
    );

    const resultPromise = new DataRepository().exportAll("genome", {
      fields: ["genome_id"],
    });
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(resultPromise).resolves.toEqual({ rows: [{ genome_id: "1" }] });
    expect(requested).toHaveLength(2);
  });

  it("fails after bounded rate-limit retries with the upstream error intact", async () => {
    vi.useFakeTimers();
    const requested = captureGateway("post", "/api/data/genome", rateLimited);

    const resultPromise = new DataRepository().exportAll("genome", {
      fields: ["genome_id"],
    });
    const expectation = expect(resultPromise).rejects.toMatchObject({
      name: "DataRepositoryError",
      message: "Too many requests",
      status: 429,
      code: "rate_limited",
    });
    await vi.runAllTimersAsync();

    await expectation;
    expect(requested).toHaveLength(4);
  });

  it("surfaces gateway errors", async () => {
    captureGateway("get", "/api/data/genome", rateLimited);

    await expect(
      new DataRepository().member("genome", { id: "1.1" }),
    ).rejects.toEqual(
      new DataRepositoryError("Too many requests", 429, "rate_limited"),
    );
  });
});
