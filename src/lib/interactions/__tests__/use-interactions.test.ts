import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { createElement } from "react";

import { DataRepositoryError } from "@/lib/data-api";

import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";

import {
  interactionsGraphFields,
  interactionsGraphRequest,
  interactionsGraphRowLimit,
  useInteractions,
} from "../use-interactions";

const scopeRql = "eq(evidence,experimental)";

function row(index: number) {
  return {
    id: `ppi-${String(index)}`,
    interactor_a: `node-a-${String(index)}`,
    interactor_b: `node-b-${String(index)}`,
  };
}

function rowsHandler(rows: unknown[], captured?: { body?: unknown }) {
  return http.post("/api/data/ppi", async ({ request }) => {
    if (captured) captured.body = await request.json();
    return HttpResponse.json({ rows });
  });
}

function render(rql = scopeRql, keyword = "") {
  return renderHook(() => useInteractions(rql, keyword), {
    wrapper: createQueryClientWrapper(),
  });
}

describe("useInteractions", () => {
  // Leaving NEXT_PUBLIC_DATA_API unset proves the dataset travels through the same-origin gateway.
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_DATA_API;
  });

  it("asks the gateway for the shared predicate and the graph's own row bound", async () => {
    const captured: { body?: unknown } = {};
    server.use(rowsHandler([row(1)], captured));

    const { result } = render(scopeRql, "groEL dnaK");

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });

    expect(captured.body).toEqual({
      operation: "export",
      rql: scopeRql,
      keyword: "groEL dnaK",
      fields: [...interactionsGraphFields],
      limit: interactionsGraphRowLimit + 1,
      sort: { field: "id", direction: "asc" },
    });
    expect(result.current.data).toEqual({
      rows: [row(1)],
      isTruncated: false,
    });
  });

  it("omits an empty predicate instead of sending a blank one", () => {
    expect(interactionsGraphRequest("", "")).toEqual({
      rql: undefined,
      keyword: undefined,
      fields: [...interactionsGraphFields],
      limit: interactionsGraphRowLimit + 1,
      sort: { field: "id", direction: "asc" },
    });
  });

  it("returns no rows for an empty result", async () => {
    server.use(rowsHandler([]));

    const { result } = render();

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(result.current.data).toEqual({ rows: [], isTruncated: false });
  });

  it("caps the graph at its row bound and reports the truncation", async () => {
    server.use(
      rowsHandler(
        Array.from({ length: interactionsGraphRowLimit + 1 }, (_, index) =>
          row(index),
        ),
      ),
    );

    const { result } = render();

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(result.current.data?.rows).toHaveLength(interactionsGraphRowLimit);
    expect(result.current.data?.isTruncated).toBe(true);
  });

  it("treats a result that exactly fills the bound as complete", async () => {
    server.use(
      rowsHandler(
        Array.from({ length: interactionsGraphRowLimit }, (_, index) =>
          row(index),
        ),
      ),
    );

    const { result } = render();

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(result.current.data?.isTruncated).toBe(false);
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
    server.use(
      rowsHandler([
        row(1),
        { id: "ppi-2", interactor_a: "node-a-2" },
      ]),
    );

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
    expect(bodies.flatMap((body) => body.ids)).toStrictEqual(ids);
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
