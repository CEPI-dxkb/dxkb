import {
  buildGatewayCollectionEnvelope,
  buildGatewayRowsEnvelope,
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
