import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { createElement } from "react";

import { POST as dataGatewayPost } from "@/app/api/data/[resource]/route";
import { DataRepositoryError } from "@/lib/data-api";
import { validateDataApiRequest } from "@/lib/data-api/validation";

import {
  makeRouteContext,
  mockNextRequest,
} from "@/test-helpers/api-route-helpers";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";

import {
  interactionsGraphFields,
  interactionsGraphRequest,
  interactionsGraphRowLimit,
  useInteractions,
} from "../use-interactions";

const scopeRql = "eq(evidence,experimental)";
const dataApiOrigin = "https://data.test";

function row(index: number) {
  return {
    id: `ppi-${String(index)}`,
    interactor_a: `node-a-${String(index)}`,
    interactor_b: `node-b-${String(index)}`,
  };
}

function rowRange(count: number) {
  return Array.from({ length: count }, (_, index) => row(index));
}

// Each gateway call gets its own client IP so the route's rate-limit bucket does not fill up.
let nextIpOctet = 0;
function freshIp(): string {
  nextIpOctet = (nextIpOctet % 250) + 1;
  return `198.51.100.${String(nextIpOctet)}`;
}

interface Upstream {
  rows: unknown[];
  /** The upstream `Content-Range` header; `null` sends none. */
  contentRange: string | null;
}

/**
 * Serves `/api/data/ppi` through the real gateway route, so the graph's request meets the real
 * validator (a request past `maxExportRows` is a 400, not a pass) and the upstream `Content-Range`
 * reaches the hook through the real server repository. `upstream` plays the Data API.
 */
function serveThroughGateway(upstream: Upstream) {
  const seen: { body?: unknown; upstreamRange?: string | null } = {};
  server.use(
    http.post("/api/data/ppi", async ({ request }) => {
      seen.body = await request.json();
      return dataGatewayPost(
        mockNextRequest({
          method: "POST",
          url: "http://localhost:3019/api/data/ppi",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": freshIp(),
          },
          body: seen.body,
        }),
        makeRouteContext({ resource: "ppi" }),
      );
    }),
    http.get(`${dataApiOrigin}/ppi/`, ({ request }) => {
      seen.upstreamRange = request.headers.get("Range");
      return HttpResponse.json(
        upstream.rows as Parameters<typeof HttpResponse.json>[0],
        upstream.contentRange === null
          ? undefined
          : { headers: { "Content-Range": upstream.contentRange } },
      );
    }),
  );
  return seen;
}

function render(rql = scopeRql, keyword = "") {
  return renderHook(() => useInteractions(rql, keyword), {
    wrapper: createQueryClientWrapper(),
  });
}

describe("useInteractions", () => {
  const savedEnv: Record<string, string | undefined> = {};
  const envNames = ["DATA_API_URL", "NEXT_PUBLIC_DATA_API", "E2E_MOCK_ENABLED"];

  // Leaving NEXT_PUBLIC_DATA_API unset proves the dataset travels through the same-origin gateway;
  // DATA_API_URL is the gateway's own upstream.
  beforeEach(() => {
    for (const name of envNames) savedEnv[name] = process.env[name];
    process.env.DATA_API_URL = dataApiOrigin;
    delete process.env.NEXT_PUBLIC_DATA_API;
    delete process.env.E2E_MOCK_ENABLED;
  });

  afterEach(() => {
    for (const name of envNames) {
      if (savedEnv[name] === undefined) Reflect.deleteProperty(process.env, name);
      else process.env[name] = savedEnv[name];
    }
  });

  it("draws at most 10,000 interactions", () => {
    // The measured cap (docs/architecture.md, Interactions): load and selection stay within budget
    // at 4x CPU throttle on real BV-BRC data. It is also `maxExportRows`, the most one export may ask
    // for, so the overflow cannot be read from one extra row and comes from the total instead.
    expect(interactionsGraphRowLimit).toBe(10_000);
  });

  it("asks the gateway for the shared predicate and exactly the graph's row bound", async () => {
    const seen = serveThroughGateway({
      rows: [row(1)],
      contentRange: "items 0-1/1",
    });

    const { result } = render(scopeRql, "groEL dnaK");

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });

    expect(seen.body).toEqual({
      operation: "export",
      rql: scopeRql,
      keyword: "groEL dnaK",
      fields: [...interactionsGraphFields],
      limit: 10_000,
      sort: { field: "id", direction: "asc" },
    });
    // The Data API's range end is exclusive: exactly the bound, not one row past it.
    expect(seen.upstreamRange).toBe("items=0-10000");
    expect(result.current.data).toEqual({
      rows: [row(1)],
      isTruncated: false,
      total: 1,
    });
  });

  it("sends a request the gateway's validator accepts", () => {
    expect(() =>
      validateDataApiRequest("ppi", {
        operation: "export",
        ...interactionsGraphRequest(scopeRql, "groEL"),
      }),
    ).not.toThrow();
  });

  it("omits an empty predicate instead of sending a blank one", () => {
    expect(interactionsGraphRequest("", "")).toEqual({
      rql: undefined,
      keyword: undefined,
      fields: [...interactionsGraphFields],
      limit: interactionsGraphRowLimit,
      sort: { field: "id", direction: "asc" },
    });
  });

  it("returns no rows for an empty result", async () => {
    serveThroughGateway({ rows: [], contentRange: "items 0-0/0" });

    const { result } = render();

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(result.current.data).toEqual({
      rows: [],
      isTruncated: false,
      total: 0,
    });
  });

  it("reports the truncation when the Data API counts more matches than the bound", async () => {
    serveThroughGateway({
      rows: rowRange(interactionsGraphRowLimit),
      contentRange: "items 0-10000/10001",
    });

    const { result } = render();

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(result.current.data?.rows).toHaveLength(interactionsGraphRowLimit);
    expect(result.current.data?.isTruncated).toBe(true);
    expect(result.current.data?.total).toBe(interactionsGraphRowLimit + 1);
  });

  it("treats a result whose total equals the rows it returned as complete, even at the bound", async () => {
    serveThroughGateway({
      rows: rowRange(interactionsGraphRowLimit),
      contentRange: "items 0-10000/10000",
    });

    const { result } = render();

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(result.current.data?.isTruncated).toBe(false);
    expect(result.current.data?.total).toBe(interactionsGraphRowLimit);
  });

  describe("without a usable total", () => {
    it("counts a result that fills the bound as truncated", async () => {
      // Exactly 10,000 matches and more than 10,000 look the same then; claiming a cut graph is
      // complete would hide rows, while a needless notice only suggests narrowing.
      serveThroughGateway({
        rows: rowRange(interactionsGraphRowLimit),
        contentRange: null,
      });

      const { result } = render();

      await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
      expect(result.current.data?.rows).toHaveLength(interactionsGraphRowLimit);
      expect(result.current.data?.isTruncated).toBe(true);
      expect(result.current.data?.total).toBeUndefined();
    });

    it("counts a result under the bound as complete", async () => {
      serveThroughGateway({
        rows: rowRange(interactionsGraphRowLimit - 1),
        contentRange: "items 0-9999/*",
      });

      const { result } = render();

      await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
      expect(result.current.data?.isTruncated).toBe(false);
      expect(result.current.data?.total).toBeUndefined();
    });

    it.each([
      ["a string", "10001"],
      ["a negative number", -1],
      ["a fraction", 10_000.5],
      ["null", null],
    ])("ignores a gateway total that is %s", async (_name, total) => {
      server.use(
        http.post("/api/data/ppi", () =>
          HttpResponse.json({ rows: rowRange(3), total }),
        ),
      );

      const { result } = render();

      await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
      expect(result.current.data).toEqual({
        rows: rowRange(3),
        isTruncated: false,
        total: undefined,
      });
    });
  });

  it("surfaces the gateway's malformed-envelope error verbatim", async () => {
    server.use(
      http.post("/api/data/ppi", () =>
        HttpResponse.json(
          { error: "Malformed data service response.", code: "malformed_response" },
          { status: 502 },
        ),
      ),
    );

    const { result } = render();

    await waitFor(() => { expect(result.current.isError).toBe(true); });
    expect(result.current.error?.message).toBe(
      "Malformed data service response.",
    );
  });

  it("rejects a row that cannot be an edge as a malformed response", async () => {
    // The gateway's ppi schema needs only an id, so this row reaches the graph's own edge schema.
    serveThroughGateway({
      rows: [row(1), { id: "ppi-2", interactor_a: "node-a-2" }],
      contentRange: "items 0-2/2",
    });

    const { result } = render();

    await waitFor(() => { expect(result.current.isError).toBe(true); });
    expect(result.current.error?.message).toContain("Malformed ppi response");
    expect(result.current.error?.message).toContain("interactor_b");
  });

  it("reports a misconfigured data service through the query error state instead of throwing", async () => {
    server.use(
      http.post("/api/data/ppi", () =>
        HttpResponse.json(
          { error: "DATA_API_URL is not configured.", code: "not_configured" },
          { status: 500 },
        ),
      ),
    );

    // Rendering must not throw: a missing upstream URL must produce the standard query error state,
    // not unmount the subview.
    const { result } = render();

    await waitFor(() => { expect(result.current.isError).toBe(true); });
    expect(result.current.error?.message).toBe(
      "DATA_API_URL is not configured.",
    );
  });
});

describe("useInteractions with a row selection", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_DATA_API;
  });

  interface SelectedBody {
    operation: string;
    ids: string[];
    fields?: string[];
    rql?: string;
    keyword?: string;
  }

  function serveSelected(respond?: (ids: string[]) => unknown[]) {
    const bodies: SelectedBody[] = [];
    server.use(
      http.post("/api/data/ppi", async ({ request }) => {
        const body = (await request.json()) as SelectedBody;
        bodies.push(body);
        return HttpResponse.json({
          rows: respond
            ? respond(body.ids)
            : body.ids.map((id) => row(Number(id.replace("ppi-", "")))),
        });
      }),
    );
    return bodies;
  }

  function renderSelection(
    selection: { ids: readonly string[]; version: number },
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    }),
  ) {
    const hook = renderHook(
      () => useInteractions(scopeRql, "groEL", selection),
      {
        wrapper: ({ children }) =>
          createElement(QueryClientProvider, { client: queryClient }, children),
      },
    );
    return { ...hook, queryClient };
  }

  it("reads exactly the selected rows by id, without the scope or keyword", async () => {
    const ids = Array.from({ length: 600 }, (_, index) => `ppi-${String(index)}`);
    const bodies = serveSelected();

    const { result } = renderSelection({ ids, version: 1 });

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(bodies).toHaveLength(2);
    for (const body of bodies) {
      expect(body.operation).toBe("selected");
      expect(body.fields).toStrictEqual([...interactionsGraphFields]);
      expect(body).not.toHaveProperty("rql");
      expect(body).not.toHaveProperty("keyword");
    }
    // The two batches are sent together, so their arrival order is not guaranteed; the rows below
    // carry the `ids` order.
    expect(bodies.flatMap((body) => body.ids).sort()).toStrictEqual(
      [...ids].sort(),
    );
    expect(result.current.data?.rows.map((entry) => entry.id)).toStrictEqual(ids);
    expect(result.current.data?.isTruncated).toBe(false);
  });

  it("keys the read on the selection's version, never on its ids", async () => {
    serveSelected();

    const { result, queryClient } = renderSelection({
      ids: ["ppi-1", "ppi-2"],
      version: 7,
    });

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(
      queryClient.getQueryCache().getAll().map((query) => query.queryKey),
    ).toStrictEqual([["interactions-graph-selected", 7]]);
  });

  it("rejects a selected row that cannot be an edge as a malformed response", async () => {
    serveSelected(() => [row(1), { id: "ppi-2", interactor_a: "node-a-2" }]);
    const exported = render();
    await waitFor(() => { expect(exported.result.current.isError).toBe(true); });

    const { result } = renderSelection({ ids: ["ppi-1", "ppi-2"], version: 1 });

    await waitFor(() => { expect(result.current.isError).toBe(true); });
    expect(result.current.error).toBeInstanceOf(DataRepositoryError);
    expect(result.current.error).toMatchObject({
      status: 502,
      code: "malformed_response",
    });
    expect(result.current.error?.message).toContain("interactor_b");
    expect(result.current.error?.message).toBe(
      exported.result.current.error?.message,
    );
  });
});
