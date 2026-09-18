import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";

import {
  fetchTaxonChildCounts,
  fetchTaxonChildren,
  taxonChildCountsKey,
  taxonChildrenKey,
} from "../use-taxon-children";

/**
 * These fetchers now go through the same-origin `/api/taxonomy-tree` route, so
 * MSW intercepts a relative path rather than an external Data API host. That
 * is the point of the change: the transport carries no `NEXT_PUBLIC_DATA_API`
 * origin baked in at build time, so it can be redirected at runtime (which is
 * what makes the E2E loopback reachable).
 *
 * The malformed-`facet_counts` rejections these tests used to own now live
 * server-side in `src/lib/data-api/__tests__/taxonomy-tree.test.ts`. What is
 * covered here is that their messages still reach the caller intact.
 */
const childrenPath = "/api/taxonomy-tree/children";
const childCountsPath = "/api/taxonomy-tree/child-counts";

describe("taxonChildrenKey", () => {
  it("keys on the parent id", () => {
    expect(taxonChildrenKey(235)).toEqual(["taxon-children", 235]);
  });
});

describe("taxonChildCountsKey", () => {
  it("is order-independent", () => {
    expect(taxonChildCountsKey([236, 235])).toEqual(
      taxonChildCountsKey([235, 236]),
    );
  });
});

describe("fetchTaxonChildren", () => {
  it("requests the parent id same-origin and returns the route's rows", async () => {
    let requestUrl = "";
    server.use(
      http.get(childrenPath, ({ request }) => {
        requestUrl = request.url;
        return HttpResponse.json({
          rows: [
            { taxon_id: "235", taxon_name: "Brucella abortus" },
            { taxon_id: "236", taxon_name: "Brucella melitensis" },
          ],
        });
      }),
    );

    const children = await fetchTaxonChildren(234);

    expect(children.map((child) => child.taxon_id)).toEqual(["235", "236"]);
    const url = new URL(requestUrl);
    expect(url.origin).toBe(window.location.origin);
    expect(url.pathname).toBe(childrenPath);
    expect(url.searchParams.get("parentId")).toBe("234");
  });

  it("keeps the route's specific message in the thrown error", async () => {
    server.use(
      http.get(childrenPath, () =>
        HttpResponse.json(
          { error: "viral branch unavailable", code: "upstream_error" },
          { status: 502 },
        ),
      ),
    );

    await expect(fetchTaxonChildren(10239)).rejects.toThrow(
      "taxonomy children 10239: viral branch unavailable",
    );
  });

  it("falls back to the status line when there is no JSON body", async () => {
    server.use(
      http.get(
        childrenPath,
        () =>
          new HttpResponse(null, {
            status: 503,
            statusText: "Service Unavailable",
          }),
      ),
    );

    await expect(fetchTaxonChildren(235)).rejects.toThrow(
      "taxonomy children 235: 503 Service Unavailable",
    );
  });

  it("rejects a response with no rows array instead of returning undefined", async () => {
    server.use(http.get(childrenPath, () => HttpResponse.json({})));

    await expect(fetchTaxonChildren(235)).rejects.toThrow(
      "taxonomy children 235: response has no rows array",
    );
  });

  it("rejects when the request is aborted", async () => {
    server.use(http.get(childrenPath, () => HttpResponse.json({ rows: [] })));
    const controller = new AbortController();
    controller.abort();

    await expect(
      fetchTaxonChildren(235, controller.signal),
    ).rejects.toThrow();
  });
});

describe("fetchTaxonChildCounts", () => {
  it("turns the route's counts object into a parentId -> count map", async () => {
    let requestUrl = "";
    server.use(
      http.get(childCountsPath, ({ request }) => {
        requestUrl = request.url;
        return HttpResponse.json({ counts: { 235: 3, 236: 0 } });
      }),
    );

    const counts = await fetchTaxonChildCounts([235, 236]);

    expect(counts.get(235)).toBe(3);
    expect(counts.get(236)).toBe(0);
    expect(
      new URL(requestUrl).searchParams.getAll("parentId"),
    ).toEqual(["235", "236"]);
  });

  it("leaves a parent the route omitted out of the map (no expand arrow)", async () => {
    server.use(
      http.get(childCountsPath, () =>
        HttpResponse.json({ counts: { 235: 3 } }),
      ),
    );

    const counts = await fetchTaxonChildCounts([235, 236]);

    expect(counts.get(235)).toBe(3);
    expect(counts.has(236)).toBe(false);
  });

  it("returns an empty map without fetching when given no ids", async () => {
    const handler = vi.fn(() => HttpResponse.json({ counts: {} }));
    server.use(http.get(childCountsPath, handler));

    const counts = await fetchTaxonChildCounts([]);

    expect(counts.size).toBe(0);
    expect(handler).not.toHaveBeenCalled();
  });

  /**
   * The eight distinct messages the route's eleven malformed-facet rejections
   * produce (several shapes share one message — see
   * `src/lib/data-api/__tests__/taxonomy-tree.test.ts`, which owns the
   * rejection-by-rejection coverage). The assertion here is narrower: whatever
   * the route diagnosed, the caller still sees that exact text, prefix
   * included, rather than a generic failure — a malformed payload must never
   * degrade into "this parent has no children".
   */
  it.each([
    "missing facet_counts header",
    "invalid facet_counts JSON",
    "missing facet_fields.parent_id",
    "expected parent/count pairs",
    "invalid parent id not-an-id",
    "invalid child count -1",
    "unexpected parent id 999",
    "duplicate parent id 235",
  ])("surfaces the route's %s rejection verbatim", async (detail) => {
    server.use(
      http.get(childCountsPath, () =>
        HttpResponse.json(
          { error: detail, code: "malformed_response" },
          { status: 502 },
        ),
      ),
    );

    await expect(fetchTaxonChildCounts([235])).rejects.toThrow(
      `taxonomy child counts: ${detail}`,
    );
  });

  it("falls back to the status line when there is no JSON body", async () => {
    server.use(
      http.get(
        childCountsPath,
        () =>
          new HttpResponse(null, {
            status: 500,
            statusText: "Internal Server Error",
          }),
      ),
    );

    await expect(fetchTaxonChildCounts([235])).rejects.toThrow(
      "taxonomy child counts: 500 Internal Server Error",
    );
  });

  it("rejects a counts payload that is not an object of counts", async () => {
    server.use(
      http.get(childCountsPath, () => HttpResponse.json({ counts: [] })),
    );

    await expect(fetchTaxonChildCounts([235])).rejects.toThrow(
      "taxonomy child counts: response has no counts object",
    );
  });

  it("rejects when the request is aborted", async () => {
    server.use(
      http.get(childCountsPath, () => HttpResponse.json({ counts: {} })),
    );
    const controller = new AbortController();
    controller.abort();

    await expect(
      fetchTaxonChildCounts([235], controller.signal),
    ).rejects.toThrow();
  });
});
