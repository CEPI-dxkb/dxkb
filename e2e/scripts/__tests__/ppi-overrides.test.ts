import { describe, expect, it } from "vitest";

import {
  buildPpiCollectionEnvelope,
  buildPpiRows,
  selectPpiRows,
} from "../../fixtures/overrides/interactions";
import type { JsonOverrideBodyContext } from "../../mocks/backends";

function context(
  parsedBody: unknown,
  requestUrl = "http://localhost/api/data/ppi",
): JsonOverrideBodyContext {
  return { parsedBody, requestUrl, method: "POST", callIndex: 0 };
}

describe("PPI overrides", () => {
  const rows = buildPpiRows(3);

  it("returns selected rows in requested order and ignores unknown IDs", () => {
    expect(
      selectPpiRows(
        rows,
        context({
          operation: "selected",
          ids: [rows[2].id, "unknown", rows[0].id],
        }),
      ).map((row) => row.id),
    ).toEqual([rows[2].id, rows[0].id]);
  });

  it("preserves all rows for export requests without a keyword", () => {
    expect(selectPpiRows(rows, context({ operation: "export" }))).toEqual(rows);
  });

  it("filters gateway GET and export requests by keyword", () => {
    expect(
      selectPpiRows(
        rows,
        context(null, "http://localhost/api/data/ppi?keyword=peg.601"),
      ).map((row) => row.id),
    ).toEqual([rows[1].id]);
    expect(
      selectPpiRows(
        rows,
        context({ operation: "export", keyword: "peg.602" }),
      ).map((row) => row.id),
    ).toEqual([rows[2].id]);
  });
});

describe("PPI gateway collection envelope", () => {
  const rows = buildPpiRows(5);
  const collection = (query: string) =>
    buildPpiCollectionEnvelope(
      rows,
      context(null, `http://localhost/api/data/ppi?operation=collection${query}`),
    );

  it("answers a one-row page with the full matching count", () => {
    const envelope = collection("&page=1&pageSize=1&field=id");

    expect(envelope.rows).toHaveLength(1);
    expect(envelope.total).toBe(5);
    expect(envelope.pageSize).toBe(1);
  });

  it("pages the rows and keeps the total", () => {
    const envelope = collection("&page=2&pageSize=2");

    expect(envelope.rows.map((row) => row.id)).toEqual([rows[2].id, rows[3].id]);
    expect(envelope.total).toBe(5);
    expect(envelope.page).toBe(2);
  });

  it("returns every row when the request names no page size", () => {
    expect(collection("").rows).toHaveLength(5);
  });

  it("counts the values of each requested facet, flattening list fields", () => {
    const envelope = collection(
      "&pageSize=1&facet=interaction_type&facet=category&facet=evidence",
    );

    expect(envelope.facets).toEqual({
      interaction_type: [{ value: "predicted interaction", count: 5 }],
      category: [{ value: "PPI", count: 5 }],
      evidence: [{ value: "experimental", count: 5 }],
    });
  });

  it("counts only the keyword's matches", () => {
    const envelope = collection("&pageSize=1&facet=category&keyword=peg.601");

    expect(envelope.total).toBe(1);
    expect(envelope.facets).toEqual({
      category: [{ value: "PPI", count: 1 }],
    });
  });

  it("returns no facets unless one is requested", () => {
    expect(collection("&pageSize=1").facets).toEqual({});
  });
});
