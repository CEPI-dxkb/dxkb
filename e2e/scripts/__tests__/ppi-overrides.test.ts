import { describe, expect, it } from "vitest";

import {
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
