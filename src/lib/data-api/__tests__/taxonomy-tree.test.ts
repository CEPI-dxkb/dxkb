import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";

import { ServerDataRepository } from "../repository";
import { DataApiValidationError } from "../resources";
import { maxRqlInValues } from "../rql";
import { pageSize as collectionPageSize } from "../validation";
import { maxExportRows } from "../types";
import {
  parseContentRangeTotal,
  parseTaxonFacetCounts,
  readTaxonChildCounts,
  readTaxonChildren,
  taxonChildCountsClause,
  taxonChildrenClause,
  taxonChildrenPageSize,
} from "../taxonomy-tree";

const baseUrl = "https://data.test";
const taxonomyUrl = `${baseUrl}/taxonomy/`;

function repository(): ServerDataRepository {
  return new ServerDataRepository({ baseUrl });
}

function facetHeader(parentIdFacet: unknown): string {
  return JSON.stringify({ facet_fields: { parent_id: parentIdFacet } });
}

describe("taxonChildrenClause", () => {
  it("replicates the legacy predicate and ordering verbatim", () => {
    expect(taxonChildrenClause(234)).toBe(
      "and(gt(genomes,1),eq(parent_id,234))&sort(+taxon_name)",
    );
  });
});

describe("taxonChildCountsClause", () => {
  it("faceted parent_id query keeps the same gt(genomes,1) filter", () => {
    expect(taxonChildCountsClause([235, 236])).toBe(
      "and(gt(genomes,1),in(parent_id,(235,236)))&facet((field,parent_id),(mincount,1))&limit(1)",
    );
  });
});

describe("taxonChildrenPageSize", () => {
  it("stays above every generic collection and export limit", () => {
    // The plan requires this bound to be isolated from generic limits. If a
    // future change ever routed the tree through the collection or export
    // operation, the bound would have to shrink to their ceilings to pass
    // `validateDataApiRequest` — this asserts the two are still far apart.
    expect(taxonChildrenPageSize).toBe(50_000);
    expect(taxonChildrenPageSize).toBeGreaterThan(collectionPageSize);
    expect(taxonChildrenPageSize).toBeGreaterThan(maxExportRows);
  });
});

describe("parseContentRangeTotal", () => {
  it("reads the total after the slash", () => {
    expect(parseContentRangeTotal("items 0-25/126")).toBe(126);
  });

  it("returns null for an absent or unparseable header", () => {
    expect(parseContentRangeTotal(null)).toBeNull();
    expect(parseContentRangeTotal("items 0-25")).toBeNull();
  });
});

describe("readTaxonChildren", () => {
  it("stitches multiple pages into one row set", async () => {
    const ranges: (string | null)[] = [];
    let callCount = 0;
    server.use(
      http.get(taxonomyUrl, ({ request }) => {
        ranges.push(request.headers.get("Range"));
        callCount++;
        if (callCount === 1) {
          return HttpResponse.json(
            [
              { taxon_id: 1, taxon_name: "Alpha", taxon_rank: "genus" },
              { taxon_id: 2, taxon_name: "Beta", taxon_rank: "genus" },
            ],
            { headers: { "Content-Range": "items 0-1/3" } },
          );
        }
        return HttpResponse.json(
          [{ taxon_id: 3, taxon_name: "Gamma", taxon_rank: "genus" }],
          { headers: { "Content-Range": "items 2-2/3" } },
        );
      }),
    );

    const { rows } = await readTaxonChildren(repository(), 235);
    expect(rows).toHaveLength(3);
    expect(callCount).toBe(2);
    // taxonomyRecordSchema normalizes taxon_id to a string.
    expect(rows.map((row) => row.taxon_id)).toEqual(["1", "2", "3"]);
    expect(ranges).toEqual(["items=0-49999", "items=2-50001"]);
  });

  it("sends the legacy predicate verbatim", async () => {
    let requestUrl = "";
    server.use(
      http.get(taxonomyUrl, ({ request }) => {
        requestUrl = request.url;
        return HttpResponse.json(
          [{ taxon_id: 235, taxon_name: "Brucella abortus" }],
          { headers: { "Content-Range": "items 0-0/1" } },
        );
      }),
    );

    await readTaxonChildren(repository(), 234);
    expect(decodeURIComponent(new URL(requestUrl).search)).toBe(
      "?and(gt(genomes,1),eq(parent_id,234))&sort(+taxon_name)",
    );
  });

  it("trusts a single page and stops when Content-Range is absent", async () => {
    let callCount = 0;
    server.use(
      http.get(taxonomyUrl, () => {
        callCount++;
        return HttpResponse.json([
          { taxon_id: 1, taxon_name: "Alpha", taxon_rank: "genus" },
        ]);
      }),
    );

    const { rows } = await readTaxonChildren(repository(), 235);
    expect(rows).toHaveLength(1);
    expect(callCount).toBe(1);
  });

  it("stops early when a page returns zero items (safety net)", async () => {
    let callCount = 0;
    server.use(
      http.get(taxonomyUrl, () => {
        callCount++;
        if (callCount === 1) {
          return HttpResponse.json(
            [{ taxon_id: 1, taxon_name: "Alpha", taxon_rank: "genus" }],
            // Total claims 5 but the next page returns nothing.
            { headers: { "Content-Range": "items 0-0/5" } },
          );
        }
        return HttpResponse.json([], {
          headers: { "Content-Range": "items 1-0/5" },
        });
      }),
    );

    const { rows } = await readTaxonChildren(repository(), 235);
    expect(rows).toHaveLength(1);
    expect(callCount).toBe(2);
  });

  it("returns no rows for an empty first page", async () => {
    server.use(
      http.get(taxonomyUrl, () =>
        HttpResponse.json([], {
          headers: { "Content-Range": "items 0-0/0" },
        }),
      ),
    );

    await expect(readTaxonChildren(repository(), 235)).resolves.toEqual({
      rows: [],
    });
  });

  it("rejects a row the production taxonomy schema refuses", async () => {
    server.use(
      http.get(taxonomyUrl, () =>
        HttpResponse.json([{ taxon_id: 0, taxon_name: "Bogus" }], {
          headers: { "Content-Range": "items 0-0/1" },
        }),
      ),
    );

    await expect(readTaxonChildren(repository(), 235)).rejects.toThrow(
      /Malformed taxonomy response/,
    );
  });

  it("surfaces the upstream message on a failed response", async () => {
    server.use(
      http.get(taxonomyUrl, () =>
        HttpResponse.json({ message: "viral branch unavailable" }, {
          status: 500,
        }),
      ),
    );

    await expect(readTaxonChildren(repository(), 10239)).rejects.toThrow(
      "viral branch unavailable",
    );
  });

  it("propagates an abort instead of resolving", async () => {
    server.use(http.get(taxonomyUrl, () => HttpResponse.json([])));
    const controller = new AbortController();
    controller.abort();

    await expect(
      readTaxonChildren(repository(), 235, controller.signal),
    ).rejects.toThrow();
  });
});

describe("readTaxonChildCounts", () => {
  it("returns the facet header as a parent-id-keyed count object", async () => {
    let range: string | null = null;
    server.use(
      http.get(taxonomyUrl, ({ request }) => {
        range = request.headers.get("Range");
        return new HttpResponse("[]", {
          headers: {
            "Content-Range": "items 0-0/0",
            facet_counts: facetHeader(["235", 3, "236", 1]),
          },
        });
      }),
    );

    await expect(
      readTaxonChildCounts(repository(), [235, 236]),
    ).resolves.toEqual({ counts: { 235: 3, 236: 1 } });
    expect(range).toBe("items=0-0");
  });

  it("leaves a parent with no qualifying children out of the object", async () => {
    server.use(
      http.get(taxonomyUrl, () =>
        // mincount,1 means the upstream omits 236 entirely.
        new HttpResponse("[]", {
          headers: { facet_counts: facetHeader(["235", 3]) },
        }),
      ),
    );

    const { counts } = await readTaxonChildCounts(repository(), [235, 236]);
    expect(counts).toEqual({ 235: 3 });
    expect(Object.hasOwn(counts, "236")).toBe(false);
  });

  it("does not let an incidental body row fail a facet-only request", async () => {
    server.use(
      http.get(taxonomyUrl, () =>
        // taxon_id 0 would fail taxonomyRecordSchema; a facet request asks for
        // items=0-0, so whatever row comes back is incidental.
        HttpResponse.json([{ taxon_id: 0 }], {
          headers: { facet_counts: facetHeader(["235", 3]) },
        }),
      ),
    );

    await expect(readTaxonChildCounts(repository(), [235])).resolves.toEqual({
      counts: { 235: 3 },
    });
  });

  it("rejects an empty parent list", async () => {
    await expect(readTaxonChildCounts(repository(), [])).rejects.toThrow(
      DataApiValidationError,
    );
  });

  it("rejects more parents than the upstream in(...) clause accepts", async () => {
    const parentIds = Array.from(
      { length: maxRqlInValues + 1 },
      (_value, index) => index + 1,
    );

    await expect(
      readTaxonChildCounts(repository(), parentIds),
    ).rejects.toThrow(/limited to 500 parents/);
  });

  it("surfaces the upstream message on a failed response", async () => {
    server.use(
      http.get(taxonomyUrl, () =>
        HttpResponse.json({ message: "facet backend down" }, { status: 500 }),
      ),
    );

    await expect(readTaxonChildCounts(repository(), [235])).rejects.toThrow(
      "facet backend down",
    );
  });
});

/**
 * The eleven rejections the Taxa Tree's child-count response must fail on.
 * They used to live in `src/components/taxonomy/__tests__/use-taxon-children.test.ts`
 * against the browser fetch; the parsing moved server-side, so they moved with
 * it. Each one is what stops malformed data from silently turning a branch
 * into a leaf, because an absent parent is the *valid* encoding of "no
 * children".
 */
describe("parseTaxonFacetCounts", () => {
  it("parses the flat [id, count, …] array into a map", () => {
    const counts = parseTaxonFacetCounts(
      facetHeader(["11320", 138, "2955291", 1]),
      [11320, 2955291],
    );
    expect([...counts]).toEqual([
      [11320, 138],
      [2955291, 1],
    ]);
  });

  it("accepts a zero count for a requested parent", () => {
    expect(parseTaxonFacetCounts(facetHeader(["235", 0]), [235]).get(235)).toBe(
      0,
    );
  });

  it("accepts an empty facet list", () => {
    expect(parseTaxonFacetCounts(facetHeader([]), [235]).size).toBe(0);
  });

  it.each([
    ["1. missing header", null, "missing facet_counts header"],
    ["2. invalid JSON", "not-json", "invalid facet_counts JSON"],
    ["3a. non-object parse", "7", "missing facet_fields.parent_id"],
    // `null` is the case the object/null guard exists for: without it, reading
    // `.facet_fields` off it raises a TypeError, which is not a DataApiError
    // and so reaches the client as the route's generic 500 instead of this
    // specific malformed-response message.
    ["3b. null parse", "null", "missing facet_fields.parent_id"],
    [
      "4. missing facet_fields",
      JSON.stringify({ response: {} }),
      "missing facet_fields.parent_id",
    ],
    [
      "5. missing facet_fields.parent_id",
      JSON.stringify({ facet_fields: {} }),
      "missing facet_fields.parent_id",
    ],
    [
      "6. non-array parent_id facet",
      JSON.stringify({ facet_fields: { parent_id: { "235": 3 } } }),
      "missing facet_fields.parent_id",
    ],
    ["7. odd-length array", facetHeader(["235"]), "expected parent/count pairs"],
    ["8a. non-integer parent id", facetHeader(["1.5", 1]), "invalid parent id"],
    ["8b. non-numeric parent id", facetHeader(["not-an-id", 1]), "invalid parent id"],
    ["8c. non-primitive parent id", facetHeader([[], 1]), "invalid parent id"],
    ["8d. empty parent id", facetHeader(["", 1]), "invalid parent id"],
    ["8e. non-positive parent id", facetHeader(["0", 1]), "invalid parent id"],
    ["9a. non-integer count", facetHeader(["235", 1.5]), "invalid child count"],
    ["9b. negative count", facetHeader(["235", -1]), "invalid child count"],
    ["9c. boolean count", facetHeader(["235", true]), "invalid child count"],
    ["9d. null count", facetHeader(["235", null]), "invalid child count"],
    ["10. parent id not requested", facetHeader(["999", 1]), "unexpected parent id 999"],
    [
      "11. duplicate parent id",
      facetHeader(["235", 1, "235", 2]),
      "duplicate parent id 235",
    ],
  ])("rejects %s", (_case, header, expected) => {
    expect(() => parseTaxonFacetCounts(header, [235])).toThrow(expected);
  });

  it("reports malformed facets as a 502 the route can pass through", () => {
    expect(() => parseTaxonFacetCounts(null, [235])).toThrow(
      expect.objectContaining({
        status: 502,
        code: "malformed_response",
      }),
    );
  });

  it("names the offending value so the failure is diagnosable", () => {
    expect(() => parseTaxonFacetCounts(facetHeader(["abc", 1]), [235])).toThrow(
      "invalid parent id abc",
    );
    expect(() => parseTaxonFacetCounts(facetHeader(["235", -4]), [235])).toThrow(
      "invalid child count -4",
    );
  });
});
