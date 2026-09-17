import {
  buildBrowserRpcError,
  buildBrowserRpcSuccess,
  buildGatewayCollectionEnvelope,
  buildGatewayRowsEnvelope,
  buildLoopbackRpcError,
  buildLoopbackRpcSuccess,
  buildLoopbackSolrEnvelope,
} from "../envelopes";

describe("buildGatewayCollectionEnvelope", () => {
  it("defaults total to rows.length, facets to {}, page to 1, pageSize to 200", () => {
    const rows = [{ id: "a" }, { id: "b" }];
    expect(buildGatewayCollectionEnvelope(rows)).toEqual({
      rows,
      total: 2,
      facets: {},
      page: 1,
      pageSize: 200,
    });
  });

  it("honors explicit overrides", () => {
    const rows = [{ id: "a" }];
    expect(
      buildGatewayCollectionEnvelope(rows, {
        total: 401,
        facets: { status: [{ value: "Complete", count: 1 }] },
        page: 2,
        pageSize: 50,
      }),
    ).toEqual({
      rows,
      total: 401,
      facets: { status: [{ value: "Complete", count: 1 }] },
      page: 2,
      pageSize: 50,
    });
  });
});

describe("buildGatewayRowsEnvelope", () => {
  it("wraps rows with no other fields", () => {
    const rows = [{ id: "a" }];
    expect(buildGatewayRowsEnvelope(rows)).toEqual({ rows });
  });
});

describe("buildLoopbackSolrEnvelope", () => {
  it("defaults numFound to docs.length and omits facet_counts", () => {
    const docs = [{ id: "a" }, { id: "b" }];
    expect(buildLoopbackSolrEnvelope(docs)).toEqual({
      response: { numFound: 2, docs },
    });
  });

  it("honors an explicit numFound and includes facet_counts when provided", () => {
    const docs = [{ id: "a" }];
    const facetCounts = { facet_fields: { status: ["Complete", 1] } };
    expect(
      buildLoopbackSolrEnvelope(docs, { numFound: 12345, facetCounts }),
    ).toEqual({
      response: { numFound: 12345, docs },
      facet_counts: facetCounts,
    });
  });
});

describe("JSON-RPC envelopes", () => {
  it("buildLoopbackRpcSuccess emits the full wire shape with a default id", () => {
    expect(buildLoopbackRpcSuccess([[]])).toEqual({
      id: 1,
      jsonrpc: "2.0",
      result: [[]],
    });
  });

  it("buildLoopbackRpcSuccess echoes an explicit request id", () => {
    expect(buildLoopbackRpcSuccess(true, 42)).toEqual({
      id: 42,
      jsonrpc: "2.0",
      result: true,
    });
  });

  it("buildLoopbackRpcError carries code and message in the JSON-RPC error body", () => {
    expect(buildLoopbackRpcError(-32601, "e2e-mock: no such method")).toEqual({
      id: 1,
      jsonrpc: "2.0",
      error: { code: -32601, message: "e2e-mock: no such method" },
    });
  });

  it("browser builders omit id/jsonrpc, which page.route() consumers ignore", () => {
    expect(buildBrowserRpcSuccess([[]])).toEqual({ result: [[]] });
    expect(buildBrowserRpcError(-32000, "Object not found")).toEqual({
      error: { code: -32000, message: "Object not found" },
    });
  });
});
