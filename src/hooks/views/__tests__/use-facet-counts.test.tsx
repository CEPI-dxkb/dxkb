import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { DataRepository, type FacetBucket } from "@/lib/data-api";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import { settleBackgroundWork } from "@/test-helpers/settle";
import { useFacetCounts, type UseFacetCountsOptions } from "../use-facet-counts";

interface FacetRead {
  operation: string | null;
  rql: string | null;
  keyword: string | null;
  keywordMode: string | null;
  pageSize: string | null;
  fields: string[];
  facets: string[];
}

function facetRead(url: URL): FacetRead {
  const params = url.searchParams;
  return {
    operation: params.get("operation"),
    rql: params.get("rql"),
    keyword: params.get("keyword"),
    keywordMode: params.get("keywordMode"),
    pageSize: params.get("pageSize"),
    fields: params.getAll("field"),
    facets: params.getAll("facet"),
  };
}

function collectionResult(facets: Partial<Record<string, FacetBucket[]>>) {
  return { rows: [], total: 0, facets, page: 1, pageSize: 1 };
}

/** Answers each facet read with `bucketsFor(field, rql)`, recording what was asked. */
function facetHandler(
  reads: FacetRead[],
  bucketsFor: (
    field: string,
    rql: string | null,
  ) => FacetBucket[] | Promise<FacetBucket[]>,
) {
  return http.get("/api/data/ppi", async ({ request }) => {
    const read = facetRead(new URL(request.url));
    reads.push(read);
    const entries = await Promise.all(
      read.facets.map(
        async (field) => [field, await bucketsFor(field, read.rql)] as const,
      ),
    );
    return HttpResponse.json(collectionResult(Object.fromEntries(entries)));
  });
}

type Props = Pick<UseFacetCountsOptions, "facetFields" | "rqlFor" | "keyword">;

function render(initialProps: Props) {
  const repository = new DataRepository();
  return renderHook(
    (props: Props) =>
      useFacetCounts({
        repository,
        resource: "ppi",
        idField: "id",
        keywordMode: "prefix",
        ...props,
      }),
    { initialProps, wrapper: createQueryClientWrapper() },
  );
}

const evidenceBuckets: FacetBucket[] = [{ value: "experimental", count: 4 }];
const methodBuckets: FacetBucket[] = [{ value: "two hybrid", count: 2 }];

describe("useFacetCounts", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_DATA_API;
  });

  it("sends no read and reports nothing loading while no facet field is asked for", async () => {
    const reads: FacetRead[] = [];
    server.use(facetHandler(reads, () => evidenceBuckets));

    const { result } = render({
      facetFields: [],
      rqlFor: () => "eq(taxon_id,562)",
    });

    await settleBackgroundWork();
    expect(reads).toEqual([]);
    expect(result.current.facets).toEqual({});
    expect(result.current.facetStatuses).toEqual({});
    expect(result.current.facetsError).toBeNull();
    expect(result.current.isFacetsLoading).toBe(false);
    expect(result.current.isFacetsRefreshing).toBe(false);
  });

  it("reads each field in its own scope with the keyword and returns its buckets", async () => {
    const reads: FacetRead[] = [];
    server.use(
      facetHandler(reads, (field) =>
        field === "evidence" ? evidenceBuckets : methodBuckets,
      ),
    );

    const { result } = render({
      facetFields: ["evidence", "detection_method"],
      rqlFor: (field) =>
        field === "evidence"
          ? "eq(taxon_id,562)"
          : "and(eq(taxon_id,562),eq(evidence,experimental))",
      keyword: "groEL",
    });

    expect(result.current.isFacetsLoading).toBe(true);
    await waitFor(() => {
      expect(result.current.facets).toEqual({
        evidence: evidenceBuckets,
        detection_method: methodBuckets,
      });
    });
    expect(result.current.facetStatuses).toEqual({
      evidence: "ready",
      detection_method: "ready",
    });
    expect(result.current.isFacetsLoading).toBe(false);
    expect(
      [...reads].sort((a, b) => a.facets[0].localeCompare(b.facets[0])),
    ).toEqual([
      {
        operation: "collection",
        rql: "and(eq(taxon_id,562),eq(evidence,experimental))",
        keyword: "groEL",
        keywordMode: "prefix",
        pageSize: "1",
        fields: ["id"],
        facets: ["detection_method"],
      },
      {
        operation: "collection",
        rql: "eq(taxon_id,562)",
        keyword: "groEL",
        keywordMode: "prefix",
        pageSize: "1",
        fields: ["id"],
        facets: ["evidence"],
      },
    ]);
  });

  it("keeps the previous scope's counts as stale until the new scope's land", async () => {
    const nextScope = Promise.withResolvers<FacetBucket[]>();
    const nextBuckets: FacetBucket[] = [{ value: "experimental", count: 1 }];
    server.use(
      facetHandler([], (_field, rql) =>
        rql === "eq(taxon_id,562)" ? evidenceBuckets : nextScope.promise,
      ),
    );

    const { result, rerender } = render({
      facetFields: ["evidence"],
      rqlFor: () => "eq(taxon_id,562)",
    });
    await waitFor(() => {
      expect(result.current.facetStatuses).toEqual({ evidence: "ready" });
    });

    rerender({ facetFields: ["evidence"], rqlFor: () => "eq(taxon_id,1280)" });

    expect(result.current.facetStatuses).toEqual({ evidence: "stale" });
    expect(result.current.facets).toEqual({ evidence: evidenceBuckets });
    expect(result.current.isFacetsRefreshing).toBe(true);
    expect(result.current.isFacetsLoading).toBe(false);

    nextScope.resolve(nextBuckets);

    await waitFor(() => {
      expect(result.current.facetStatuses).toEqual({ evidence: "ready" });
    });
    expect(result.current.facets).toEqual({ evidence: nextBuckets });
    expect(result.current.isFacetsRefreshing).toBe(false);
  });

  it("drops a field's counts when its read fails and reports the error", async () => {
    server.use(
      http.get("/api/data/ppi", ({ request }) =>
        new URL(request.url).searchParams.get("rql") === "eq(taxon_id,562)"
          ? HttpResponse.json(collectionResult({ evidence: evidenceBuckets }))
          : HttpResponse.json(
              {
                error: "Data service did not respond.",
                code: "upstream_timeout",
              },
              { status: 504 },
            ),
      ),
    );

    const { result, rerender } = render({
      facetFields: ["evidence"],
      rqlFor: () => "eq(taxon_id,562)",
    });
    await waitFor(() => {
      expect(result.current.facets).toEqual({ evidence: evidenceBuckets });
    });

    rerender({ facetFields: ["evidence"], rqlFor: () => "eq(taxon_id,1280)" });

    await waitFor(() => {
      expect(result.current.facetsError?.message).toBe(
        "Data service did not respond.",
      );
    });
    expect(result.current.facets).toEqual({});
    expect(result.current.facetStatuses).toEqual({ evidence: "ready" });
    expect(result.current.isFacetsLoading).toBe(false);
    expect(result.current.isFacetsRefreshing).toBe(false);
  });
});
