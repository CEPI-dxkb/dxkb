import { createElement, type ReactNode } from "react";
import {
  CancelledError,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { DataRepository } from "@/lib/data-api";
import type { CollectionState } from "@/lib/views/collection-state";
import { noop } from "@/lib/utils";
import { resourceCollectionPageSize } from "../collection-state";
import { useResourceCollection } from "../use-resource-collection";

const initialState: CollectionState = {
  filters: {},
  page: 1,
  sort: "genome_name:asc",
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return createElement(QueryClientProvider, { client }, children);
}

function repository() {
  return {
    collection: vi.fn().mockResolvedValue({
      rows: [{ genome_id: "100.1", genome_name: "Page value" }],
      total: 2,
      facets: {},
      page: 1,
      pageSize: 200,
    }),
    member: vi.fn().mockResolvedValue({
      row: {
        genome_id: "100.1",
        genome_name: "Projected detail",
        host_name: "Human",
      },
    }),
  } as unknown as DataRepository;
}

/**
 * One client for the whole test. `wrapper` builds a new client each time it
 * renders, so after a `rerender` or a remount it starts from an empty cache; a
 * test that counts requests across renders needs this one instead.
 */
function sharedClientWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function SharedClientWrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

describe("useResourceCollection", () => {
  it("omits repository and table sorting for the unsorted state", async () => {
    const data = repository();
    const collection = vi.spyOn(data, "collection");
    const { result } = renderHook(
      () =>
        useResourceCollection({
          repository: data,
          resource: "serology",
          idField: "id",
          prefetchNextPage: false,
          fields: ["id", "sample_identifier"],
          state: { filters: {}, page: 1, sort: "unsorted" },
          onStateChange: vi.fn(),
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });
    expect(collection.mock.calls[0]?.[1].sort).toBeUndefined();
    expect(result.current.sorting).toEqual([]);
  });

  const legacyOrder = {
    field: "genome_name",
    direction: "asc",
    then: [{ field: "accession", direction: "asc" }],
  } as const;

  it("reads an unsorted collection in its unsorted order without marking a column", async () => {
    const data = repository();
    const collection = vi.spyOn(data, "collection");
    const { result } = renderHook(
      () =>
        useResourceCollection({
          repository: data,
          resource: "genome_feature",
          idField: "feature_id",
          prefetchNextPage: false,
          fields: ["feature_id", "genome_name"],
          unsortedOrder: legacyOrder,
          state: { filters: {}, page: 1, sort: "unsorted" },
          onStateChange: vi.fn(),
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });
    expect(collection.mock.calls[0]?.[1].sort).toEqual(legacyOrder);
    expect(result.current.sorting).toEqual([]);
  });

  it("reads a picked column's sort alone, not the unsorted order", async () => {
    const data = repository();
    const collection = vi.spyOn(data, "collection");
    renderHook(
      () =>
        useResourceCollection({
          repository: data,
          resource: "genome_feature",
          idField: "feature_id",
          prefetchNextPage: false,
          fields: ["feature_id", "start"],
          unsortedOrder: legacyOrder,
          state: { filters: {}, page: 1, sort: "start:desc" },
          onStateChange: vi.fn(),
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(collection).toHaveBeenCalled();
    });
    expect(collection.mock.calls[0]?.[1].sort).toEqual({
      field: "start",
      direction: "desc",
    });
  });

  it("preserves selection across paging and sorting, then resets it for a new query", async () => {
    const data = repository();
    const onStateChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ state }: { state: CollectionState }) =>
        useResourceCollection({
          repository: data,
          resource: "genome",
          idField: "genome_id",
          prefetchNextPage: false,
          fields: ["genome_id", "genome_name"],
          state,
          onStateChange,
        }),
      { wrapper, initialProps: { state: initialState } },
    );
    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });

    act(() => {
      result.current.setSelection({ "100.1": true });
    });
    rerender({ state: { ...initialState, page: 2 } });
    expect(result.current.selectedIds).toEqual(["100.1"]);

    rerender({ state: { ...initialState, sort: "genome_name:desc" } });
    expect(result.current.selectedIds).toEqual(["100.1"]);

    rerender({ state: { ...initialState, keyword: "new query" } });
    expect(result.current.selectedIds).toEqual([]);
  });

  /**
   * Serology and Surveillance row ids ARE digit-only strings ("000123" appears
   * in serology-view.test.ts), so `"0012"` and `"12"` are two real, distinct
   * selections that must not collapse into one.
   *
   * Today that is free: `selectedIds` is `Object.keys` over a
   * `Record<string, boolean>`, and object keys cannot coerce. The guarantee
   * disappears SILENTLY the moment selection state moves off
   * `RowSelectionState` — to a `Map`, to a number keying, or to any dedupe
   * that parses ids — and nothing else in the suite would fail. Hence the
   * exact ids rather than a count.
   *
   * The expected order is deliberately NOT sorted: `"12"` is a canonical
   * integer-index string and so enumerates ahead of the leading-zero keys
   * regardless of insertion order, while `"0012"` and `"000123"` follow in
   * insertion order. Alphabetical order would be the reverse, so a `.sort()`
   * creeping into the derivation fails here.
   */
  it("keeps digit-only selection ids distinct, in enumeration order", async () => {
    const data = repository();
    const { result } = renderHook(
      () =>
        useResourceCollection({
          repository: data,
          resource: "serology",
          idField: "id",
          prefetchNextPage: false,
          fields: ["id", "sample_identifier"],
          state: initialState,
          onStateChange: vi.fn(),
        }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });

    act(() => {
      result.current.setSelection({
        "0012": true,
        "12": true,
        "000123": true,
      });
    });

    expect(result.current.selectedIds).toEqual(["12", "0012", "000123"]);
  });

  it("does not prefetch the next page when the caller opts out", async () => {
    const data = repository();
    const collection = vi.spyOn(data, "collection").mockResolvedValue({
      rows: [{ genome_id: "100.1", genome_name: "Page 1" }],
      total: 401,
      facets: {},
      page: 1,
      pageSize: 200,
    });
    const { result } = renderHook(
      () =>
        useResourceCollection({
          repository: data,
          resource: "genome",
          idField: "genome_id",
          prefetchNextPage: false,
          fields: ["genome_id", "genome_name"],
          state: initialState,
          onStateChange: vi.fn(),
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.total).toBe(401);
    });
    expect(collection).toHaveBeenCalledTimes(1);
    expect(collection.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ page: 1 }),
    );
  });

  it("prefetches the next page when enabled but refreshes it during pagination", async () => {
    const data = repository();
    const collection = vi.spyOn(data, "collection").mockImplementation(
      (_resource, request) => Promise.resolve({
        rows: [
          {
            genome_id: `100.${String(request.page ?? 1)}`,
            genome_name: `Page ${String(request.page ?? 1)}`,
          },
        ],
        total: 401,
        facets: {},
        page: request.page ?? 1,
        pageSize: request.pageSize ?? 200,
      }),
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const queryWrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    const { result, rerender } = renderHook(
      ({ state }: { state: CollectionState }) =>
        useResourceCollection({
          repository: data,
          resource: "genome",
          idField: "genome_id",
          fields: ["genome_id", "genome_name"],
          prefetchNextPage: true,
          state,
          onStateChange: vi.fn(),
        }),
      { wrapper: queryWrapper, initialProps: { state: initialState } },
    );

    await waitFor(() => {
      expect(collection).toHaveBeenCalledWith(
        "genome",
        expect.objectContaining({ page: 2 }),
        expect.any(AbortSignal),
      );
    });
    rerender({ state: { ...initialState, page: 2 } });
    await waitFor(() => {
      expect(result.current.rows).toEqual([
        { genome_id: "100.2", genome_name: "Page 2" },
      ]);
    });
    expect(
      collection.mock.calls.filter(([, request]) => request.page === 2),
    ).toHaveLength(2);
  });

  it("does not prefetch from a previous query's placeholder total", async () => {
    const data = repository();
    const replacementResponse = Promise.withResolvers<
      Awaited<ReturnType<DataRepository["collection"]>>
    >();
    const collection = vi.spyOn(data, "collection").mockImplementation(
      (_resource, request) =>
        request.rql === "keyword(N034)"
          ? replacementResponse.promise
          : Promise.resolve({
              rows: [{ id: "1", sample_identifier: "Initial result" }],
              total: resourceCollectionPageSize + 1,
              facets: {},
              page: request.page ?? 1,
              pageSize: request.pageSize ?? resourceCollectionPageSize,
            }),
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const queryWrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    const { rerender } = renderHook(
      ({ rql }: { rql?: string }) =>
        useResourceCollection({
          repository: data,
          resource: "serology",
          idField: "id",
          fields: ["id", "sample_identifier"],
          prefetchNextPage: true,
          structuralRql: rql,
          state: { filters: {}, page: 1, sort: "unsorted", keyword: "influenza" },
          onStateChange: vi.fn(),
        }),
      {
        wrapper: queryWrapper,
        initialProps: { rql: undefined as string | undefined },
      },
    );
    await waitFor(() => {
      expect(collection).toHaveBeenCalledWith(
        "serology",
        expect.objectContaining({ keyword: "influenza", page: 2 }),
        expect.any(AbortSignal),
      );
    });

    collection.mockClear();
    rerender({ rql: "keyword(N034)" });

    await waitFor(() => {
      expect(collection).toHaveBeenCalledWith(
        "serology",
        expect.objectContaining({
          keyword: "influenza",
          rql: "keyword(N034)",
          page: 1,
        }),
        expect.any(AbortSignal),
      );
    });
    expect(
      collection.mock.calls.some(
        ([, request]) => request.rql === "keyword(N034)" && request.page === 2,
      ),
    ).toBe(false);

    replacementResponse.resolve({
      rows: [],
      total: 0,
      facets: {},
      page: 1,
      pageSize: resourceCollectionPageSize,
    });
  });

  it("represents all-matching selection without requesting a member detail", async () => {
    const data = repository();
    const member = vi.spyOn(data, "member");
    const { result } = renderHook(
      () =>
        useResourceCollection({
          repository: data,
          resource: "genome",
          idField: "genome_id",
          prefetchNextPage: false,
          fields: ["genome_id", "genome_name"],
          state: initialState,
          onStateChange: vi.fn(),
        }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.total).toBe(2);
    });

    act(() => {
      result.current.setSelection({});
      result.current.setIsAllPagesSelected(true);
    });

    expect(result.current.isAllPagesSelected).toBe(true);
    expect(result.current.activeId).toBeNull();
    expect(result.current.selectedIds).toEqual([]);
    expect(member).not.toHaveBeenCalled();
  });

  it("requests the detail projection and replaces the page-row fallback", async () => {
    const data = repository();
    const member = vi.spyOn(data, "member");
    const { result } = renderHook(
      () =>
        useResourceCollection({
          repository: data,
          resource: "genome",
          idField: "genome_id",
          prefetchNextPage: false,
          fields: ["genome_id", "genome_name"],
          detailFields: ["genome_id", "genome_name", "host_name"],
          state: initialState,
          onStateChange: vi.fn(),
        }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });

    act(() => {
      result.current.setSelection({ "100.1": true });
    });
    expect(result.current.detail).toMatchObject({ genome_name: "Page value" });
    await waitFor(() => {
      expect(result.current.detail).toMatchObject({
        genome_name: "Projected detail",
        host_name: "Human",
      });
    });
    expect(member).toHaveBeenCalledWith(
      "genome",
      {
        id: "100.1",
        idField: "genome_id",
        fields: ["genome_id", "genome_name", "host_name"],
      },
      expect.any(AbortSignal),
    );
  });

  it("shows the loaded page row without waiting while the detail projection is pending", async () => {
    const data = repository();
    let resolveMember: (value: { row: Record<string, unknown> }) => void =
      () => undefined;
    const member = vi.spyOn(data, "member").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMember = resolve;
        }),
    );
    const { result } = renderHook(
      () =>
        useResourceCollection({
          repository: data,
          resource: "genome",
          idField: "genome_id",
          prefetchNextPage: false,
          fields: ["genome_id", "genome_name"],
          detailFields: ["genome_id", "genome_name", "host_name"],
          state: initialState,
          onStateChange: vi.fn(),
        }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });

    act(() => {
      result.current.setSelection({ "100.1": true });
    });
    await waitFor(() => {
      expect(member).toHaveBeenCalled();
    });
    expect(result.current.detail).toMatchObject({ genome_name: "Page value" });
    expect(result.current.isDetailLoading).toBe(false);

    act(() => {
      resolveMember({
        row: {
          genome_id: "100.1",
          genome_name: "Projected detail",
          host_name: "Human",
        },
      });
    });
    await waitFor(() => {
      expect(result.current.detail).toMatchObject({ host_name: "Human" });
    });
    expect(result.current.isDetailLoading).toBe(false);
  });

  it("reports the detail as loading when the selected row is not on the loaded page", async () => {
    const data = repository();
    const member = vi
      .spyOn(data, "member")
      .mockImplementation(() => new Promise(() => undefined));
    const { result } = renderHook(
      () =>
        useResourceCollection({
          repository: data,
          resource: "genome",
          idField: "genome_id",
          prefetchNextPage: false,
          fields: ["genome_id", "genome_name"],
          state: initialState,
          onStateChange: vi.fn(),
        }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });

    // Selected on another page, so no loaded row can stand in for it.
    act(() => {
      result.current.setSelection({ "200.1": true });
    });
    await waitFor(() => {
      expect(member).toHaveBeenCalled();
    });
    expect(result.current.detail).toBeNull();
    expect(result.current.isDetailLoading).toBe(true);
  });

  it("issues a fresh request when the detail projection changes for the same selected ID", async () => {
    const data = repository();
    const member = vi.spyOn(data, "member").mockImplementation(
      (_resource, request) =>
        Promise.resolve({
          row: request.fields?.includes("host_name")
            ? {
                genome_id: "100.1",
                genome_name: "Projected detail",
                host_name: "Human",
              }
            : { genome_id: "100.1", genome_name: "Projected detail" },
        }),
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const queryWrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);

    const { result, rerender } = renderHook(
      ({ detailFields }: { detailFields: readonly string[] }) =>
        useResourceCollection({
          repository: data,
          resource: "genome",
          idField: "genome_id",
          prefetchNextPage: false,
          fields: ["genome_id", "genome_name"],
          detailFields,
          state: initialState,
          onStateChange: vi.fn(),
        }),
      {
        wrapper: queryWrapper,
        initialProps: {
          detailFields: ["genome_id", "genome_name"] as readonly string[],
        },
      },
    );

    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });

    act(() => {
      result.current.setSelection({ "100.1": true });
    });
    await waitFor(() => {
      expect(result.current.detail).toMatchObject({
        genome_name: "Projected detail",
      });
    });
    expect(result.current.detail).not.toHaveProperty("host_name");
    expect(member).toHaveBeenCalledTimes(1);

    // Same selected ID, but a view requesting a wider detail projection —
    // must not be served the previous view's incompletely-projected record.
    rerender({ detailFields: ["genome_id", "genome_name", "host_name"] });

    await waitFor(() => {
      expect(result.current.detail).toMatchObject({ host_name: "Human" });
    });
    expect(member).toHaveBeenCalledTimes(2);
    expect(member).toHaveBeenLastCalledWith(
      "genome",
      {
        id: "100.1",
        idField: "genome_id",
        fields: ["genome_id", "genome_name", "host_name"],
      },
      expect.any(AbortSignal),
    );
  });
  it("reads facet counts once per scope, apart from the paged rows", async () => {
    const data = repository();
    const collection = vi.spyOn(data, "collection").mockImplementation(
      (_resource, request) =>
        Promise.resolve({
          rows: request.facets
            ? []
            : [{ genome_id: "100.1", genome_name: "Page value" }],
          total: 401,
          facets: request.facets
            ? { genome_status: [{ value: "Complete", count: 401 }] }
            : {},
          page: request.page ?? 1,
          pageSize: request.pageSize ?? 200,
        }),
    );
    const { result, rerender } = renderHook(
      ({ state }: { state: CollectionState }) =>
        useResourceCollection({
          repository: data,
          resource: "genome",
          idField: "genome_id",
          fields: ["genome_id", "genome_name"],
          facetFields: ["genome_status"],
          prefetchNextPage: false,
          state,
          onStateChange: vi.fn(),
        }),
      { wrapper: sharedClientWrapper(), initialProps: { state: initialState } },
    );
    const facetRequests = () =>
      collection.mock.calls.filter(([, request]) => request.facets);
    const rowRequests = () =>
      collection.mock.calls.filter(([, request]) => !request.facets);

    await waitFor(() => {
      expect(result.current.facets).toEqual({
        genome_status: [{ value: "Complete", count: 401 }],
      });
    });
    expect(result.current.rows).toEqual([
      { genome_id: "100.1", genome_name: "Page value" },
    ]);
    expect(facetRequests()).toEqual([
      [
        "genome",
        {
          rql: undefined,
          keyword: undefined,
          keywordMode: undefined,
          pageSize: 1,
          fields: ["genome_id"],
          facets: ["genome_status"],
        },
        expect.any(AbortSignal),
      ],
    ]);
    expect(rowRequests()).toEqual([
      ["genome", expect.objectContaining({ page: 1 }), expect.any(AbortSignal)],
    ]);

    rerender({
      state: { ...initialState, page: 2, sort: "genome_name:desc" },
    });
    await waitFor(() => {
      expect(rowRequests()).toContainEqual([
        "genome",
        expect.objectContaining({ page: 2 }),
        expect.any(AbortSignal),
      ]);
    });
    expect(facetRequests()).toHaveLength(1);
    expect(result.current.facets).toEqual({
      genome_status: [{ value: "Complete", count: 401 }],
    });
  });

  it("keeps the rows when the facet read fails, reports its error apart, and retries it alone", async () => {
    const data = repository();
    const collection = vi
      .spyOn(data, "collection")
      .mockImplementation((_resource, request) =>
        request.facets
          ? Promise.reject(new Error("Facet query timed out upstream."))
          : Promise.resolve({
              rows: [{ genome_id: "100.1", genome_name: "Page value" }],
              total: 1,
              facets: {},
              page: 1,
              pageSize: 200,
            }),
      );
    const { result } = renderHook(
      () =>
        useResourceCollection({
          repository: data,
          resource: "genome",
          idField: "genome_id",
          fields: ["genome_id", "genome_name"],
          facetFields: ["genome_status"],
          prefetchNextPage: false,
          state: initialState,
          onStateChange: vi.fn(),
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.facetsError?.message).toBe(
        "Facet query timed out upstream.",
      );
    });
    expect(result.current.error).toBeNull();
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.facets).toEqual({});

    collection.mockClear();
    collection.mockImplementation(() =>
      Promise.resolve({
        rows: [],
        total: 1,
        facets: { genome_status: [{ value: "Complete", count: 1 }] },
        page: 1,
        pageSize: 1,
      }),
    );
    await act(async () => {
      await result.current.refetchFacets();
    });
    // TanStack notifies observers on a timer, after `act` has returned.
    await waitFor(() => {
      expect(result.current.facetsError).toBeNull();
    });
    expect(result.current.facets).toEqual({
      genome_status: [{ value: "Complete", count: 1 }],
    });
    expect(collection).toHaveBeenCalledOnce();
  });

  it("reports facet loading while the rows are already on screen", async () => {
    const data = repository();
    const facetResponse = Promise.withResolvers<
      Awaited<ReturnType<DataRepository["collection"]>>
    >();
    vi.spyOn(data, "collection").mockImplementation((_resource, request) =>
      request.facets
        ? facetResponse.promise
        : Promise.resolve({
            rows: [{ genome_id: "100.1", genome_name: "Page value" }],
            total: 1,
            facets: {},
            page: 1,
            pageSize: 200,
          }),
    );
    const { result } = renderHook(
      () =>
        useResourceCollection({
          repository: data,
          resource: "genome",
          idField: "genome_id",
          fields: ["genome_id", "genome_name"],
          facetFields: ["genome_status"],
          prefetchNextPage: false,
          state: initialState,
          onStateChange: vi.fn(),
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });
    expect(result.current.isFacetsLoading).toBe(true);
    expect(result.current.isFacetsRefreshing).toBe(false);

    act(() => {
      facetResponse.resolve({
        rows: [],
        total: 1,
        facets: { genome_status: [{ value: "Complete", count: 1 }] },
        page: 1,
        pageSize: 1,
      });
    });
    await waitFor(() => {
      expect(result.current.isFacetsLoading).toBe(false);
    });
    expect(result.current.facets).toEqual({
      genome_status: [{ value: "Complete", count: 1 }],
    });
  });

  it("marks the previous scope's counts as refreshing until the new scope's arrive", async () => {
    const data = repository();
    const nextScope = Promise.withResolvers<
      Awaited<ReturnType<DataRepository["collection"]>>
    >();
    vi.spyOn(data, "collection").mockImplementation((_resource, request) => {
      if (!request.facets) {
        return Promise.resolve({
          rows: [{ genome_id: "100.1", genome_name: "Page value" }],
          total: 1,
          facets: {},
          page: 1,
          pageSize: 200,
        });
      }
      if (request.keyword === "coli") return nextScope.promise;
      return Promise.resolve({
        rows: [],
        total: 9,
        facets: { genome_status: [{ value: "Complete", count: 9 }] },
        page: 1,
        pageSize: 1,
      });
    });
    const { result, rerender } = renderHook(
      ({ state }: { state: CollectionState }) =>
        useResourceCollection({
          repository: data,
          resource: "genome",
          idField: "genome_id",
          fields: ["genome_id", "genome_name"],
          facetFields: ["genome_status"],
          prefetchNextPage: false,
          state,
          onStateChange: vi.fn(),
        }),
      { wrapper: sharedClientWrapper(), initialProps: { state: initialState } },
    );
    await waitFor(() => {
      expect(result.current.facets).toEqual({
        genome_status: [{ value: "Complete", count: 9 }],
      });
    });
    expect(result.current.isFacetsRefreshing).toBe(false);

    rerender({ state: { ...initialState, keyword: "coli" } });
    await waitFor(() => {
      expect(result.current.isFacetsRefreshing).toBe(true);
    });
    expect(result.current.isFacetsLoading).toBe(false);
    expect(result.current.facets).toEqual({
      genome_status: [{ value: "Complete", count: 9 }],
    });

    act(() => {
      nextScope.resolve({
        rows: [],
        total: 2,
        facets: { genome_status: [{ value: "Complete", count: 2 }] },
        page: 1,
        pageSize: 1,
      });
    });
    await waitFor(() => {
      expect(result.current.isFacetsRefreshing).toBe(false);
    });
    expect(result.current.facets).toEqual({
      genome_status: [{ value: "Complete", count: 2 }],
    });
  });

  it("reuses facet counts on a remount inside their stale window", async () => {
    const data = repository();
    const collection = vi.spyOn(data, "collection").mockImplementation(
      (_resource, request) =>
        Promise.resolve({
          rows: request.facets
            ? []
            : [{ genome_id: "100.1", genome_name: "Page value" }],
          total: 1,
          facets: request.facets
            ? { genome_status: [{ value: "Complete", count: 1 }] }
            : {},
          page: 1,
          pageSize: request.pageSize ?? 200,
        }),
    );
    const clientWrapper = sharedClientWrapper();
    const renderCollection = () =>
      renderHook(
        () =>
          useResourceCollection({
            repository: data,
            resource: "genome",
            idField: "genome_id",
            fields: ["genome_id", "genome_name"],
            facetFields: ["genome_status"],
            prefetchNextPage: false,
            state: initialState,
            onStateChange: vi.fn(),
          }),
        { wrapper: clientWrapper },
      );

    const first = renderCollection();
    await waitFor(() => {
      expect(first.result.current.facets).toEqual({
        genome_status: [{ value: "Complete", count: 1 }],
      });
    });
    first.unmount();

    const second = renderCollection();
    // The rows stay stale-on-arrival (`staleTime: 0`), so the remount refreshes them.
    await waitFor(() => {
      expect(
        collection.mock.calls.filter(([, request]) => !request.facets),
      ).toHaveLength(2);
    });
    expect(second.result.current.facets).toEqual({
      genome_status: [{ value: "Complete", count: 1 }],
    });
    expect(
      collection.mock.calls.filter(([, request]) => request.facets),
    ).toHaveLength(1);
  });
  it("marks the previous page's rows as placeholder data until the new page arrives", async () => {
    const data = repository();
    const pageTwo = Promise.withResolvers<
      Awaited<ReturnType<DataRepository["collection"]>>
    >();
    vi.spyOn(data, "collection").mockImplementation((_resource, request) =>
      request.page === 2
        ? pageTwo.promise
        : Promise.resolve({
            rows: [{ genome_id: "100.1", genome_name: "Page 1" }],
            total: 401,
            facets: {},
            page: 1,
            pageSize: 200,
          }),
    );
    const { result, rerender } = renderHook(
      ({ state }: { state: CollectionState }) =>
        useResourceCollection({
          repository: data,
          resource: "genome",
          idField: "genome_id",
          fields: ["genome_id", "genome_name"],
          prefetchNextPage: false,
          state,
          onStateChange: vi.fn(),
        }),
      { wrapper: sharedClientWrapper(), initialProps: { state: initialState } },
    );
    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });
    expect(result.current.isPlaceholderData).toBe(false);

    rerender({ state: { ...initialState, page: 2 } });
    await waitFor(() => {
      expect(result.current.isPlaceholderData).toBe(true);
    });
    expect(result.current.rows).toEqual([
      { genome_id: "100.1", genome_name: "Page 1" },
    ]);

    act(() => {
      pageTwo.resolve({
        rows: [{ genome_id: "100.2", genome_name: "Page 2" }],
        total: 401,
        facets: {},
        page: 2,
        pageSize: 200,
      });
    });
    await waitFor(() => {
      expect(result.current.isPlaceholderData).toBe(false);
    });
  });
  it("reports a page that is not loaded yet as page loading, but not a same-page change", async () => {
    const data = repository();
    const pending = Promise.withResolvers<
      Awaited<ReturnType<DataRepository["collection"]>>
    >();
    vi.spyOn(data, "collection").mockImplementation((_resource, request) =>
      request.page === 2 || request.sort?.direction === "desc"
        ? pending.promise
        : Promise.resolve({
            rows: [{ genome_id: "100.1", genome_name: "Page 1" }],
            total: 401,
            facets: {},
            page: request.page ?? 1,
            pageSize: 200,
          }),
    );
    const { result, rerender } = renderHook(
      ({ state }: { state: CollectionState }) =>
        useResourceCollection({
          repository: data,
          resource: "genome",
          idField: "genome_id",
          fields: ["genome_id", "genome_name"],
          prefetchNextPage: false,
          state,
          onStateChange: vi.fn(),
        }),
      { wrapper: sharedClientWrapper(), initialProps: { state: initialState } },
    );
    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });
    expect(result.current.isPageLoading).toBe(false);

    // Another page: page 1's rows stand in, so the table shows its skeleton,
    // while page 1's total keeps the pager in place.
    rerender({ state: { ...initialState, page: 2 } });
    await waitFor(() => {
      expect(result.current.isPageLoading).toBe(true);
    });
    expect(result.current.isInitialLoading).toBe(false);
    expect(result.current.total).toBe(401);

    // The same page in another order keeps the rows on screen meanwhile.
    rerender({ state: { ...initialState, sort: "genome_name:desc" } });
    await waitFor(() => {
      expect(result.current.isPlaceholderData).toBe(true);
    });
    expect(result.current.isPageLoading).toBe(false);
    expect(result.current.rows).toEqual([
      { genome_id: "100.1", genome_name: "Page 1" },
    ]);

    act(() => {
      pending.resolve({
        rows: [{ genome_id: "100.9", genome_name: "Sorted" }],
        total: 401,
        facets: {},
        page: 1,
        pageSize: 200,
      });
    });
    await waitFor(() => {
      expect(result.current.isPlaceholderData).toBe(false);
    });
    expect(result.current.isPageLoading).toBe(false);
  });
  it("resolves the current total from the rows on screen without another read", async () => {
    const data = repository();
    const collection = vi.spyOn(data, "collection");
    const { result } = renderHook(
      () =>
        useResourceCollection({
          repository: data,
          resource: "genome",
          idField: "genome_id",
          fields: ["genome_id", "genome_name"],
          prefetchNextPage: false,
          state: initialState,
          onStateChange: vi.fn(),
        }),
      { wrapper: sharedClientWrapper() },
    );
    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });

    await expect(result.current.currentTotal()).resolves.toBe(2);
    expect(collection).toHaveBeenCalledTimes(1);
  });
  it("resolves the current total from a placeholder query's own read once it lands", async () => {
    const data = repository();
    const sorted = Promise.withResolvers<
      Awaited<ReturnType<DataRepository["collection"]>>
    >();
    const collection = vi
      .spyOn(data, "collection")
      .mockImplementation((_resource, request) =>
        request.sort?.direction === "desc"
          ? sorted.promise
          : Promise.resolve({
              rows: [{ genome_id: "100.1", genome_name: "Page 1" }],
              total: 401,
              facets: {},
              page: 1,
              pageSize: 200,
            }),
      );
    const { result, rerender } = renderHook(
      ({ state }: { state: CollectionState }) =>
        useResourceCollection({
          repository: data,
          resource: "genome",
          idField: "genome_id",
          fields: ["genome_id", "genome_name"],
          prefetchNextPage: false,
          state,
          onStateChange: vi.fn(),
        }),
      { wrapper: sharedClientWrapper(), initialProps: { state: initialState } },
    );
    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });
    rerender({ state: { ...initialState, sort: "genome_name:desc" } });
    await waitFor(() => {
      expect(result.current.isPlaceholderData).toBe(true);
    });

    // The previous query's 401 is on screen; the total waits for this query's.
    let resolved: number | undefined;
    const total = result.current.currentTotal().then((value) => {
      resolved = value;
      return value;
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(resolved).toBeUndefined();

    act(() => {
      sorted.resolve({
        rows: [{ genome_id: "100.9", genome_name: "Sorted" }],
        total: 37,
        facets: {},
        page: 1,
        pageSize: 200,
      });
    });
    await expect(total).resolves.toBe(37);
    // It joined the in-flight read rather than sending its own.
    expect(collection).toHaveBeenCalledTimes(2);
  });
  it("cancels a pending current total when the query it waits for is replaced", async () => {
    const data = repository();
    vi.spyOn(data, "collection").mockImplementation((_resource, request) =>
      request.sort?.direction === "desc"
        ? new Promise(noop)
        : Promise.resolve({
            rows: [{ genome_id: "100.1", genome_name: "Page 1" }],
            total: 401,
            facets: {},
            page: 1,
            pageSize: 200,
          }),
    );
    const { result, rerender } = renderHook(
      ({ state }: { state: CollectionState }) =>
        useResourceCollection({
          repository: data,
          resource: "genome",
          idField: "genome_id",
          fields: ["genome_id", "genome_name"],
          prefetchNextPage: false,
          state,
          onStateChange: vi.fn(),
        }),
      { wrapper: sharedClientWrapper(), initialProps: { state: initialState } },
    );
    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });
    rerender({ state: { ...initialState, sort: "genome_name:desc" } });
    await waitFor(() => {
      expect(result.current.isPlaceholderData).toBe(true);
    });
    const total = result.current.currentTotal();

    rerender({ state: initialState });

    await expect(total).rejects.toBeInstanceOf(CancelledError);
  });
  it("sends no facet read and reports no facet loading without facet fields", async () => {
    const data = repository();
    const collection = vi.spyOn(data, "collection");
    const { result } = renderHook(
      () =>
        useResourceCollection({
          repository: data,
          resource: "genome",
          idField: "genome_id",
          fields: ["genome_id", "genome_name"],
          facetFields: [],
          prefetchNextPage: false,
          state: initialState,
          onStateChange: vi.fn(),
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });
    expect(collection).toHaveBeenCalledOnce();
    expect(collection.mock.calls[0]?.[1]).not.toHaveProperty("facets");
    expect(result.current.isFacetsLoading).toBe(false);
    expect(result.current.isFacetsRefreshing).toBe(false);
    expect(result.current.facets).toEqual({});
  });

  it("reads only a newly shown facet, keeping the counted ones as they are", async () => {
    const data = repository();
    const hostName = Promise.withResolvers<
      Awaited<ReturnType<DataRepository["collection"]>>
    >();
    const collection = vi
      .spyOn(data, "collection")
      .mockImplementation((_resource, request) => {
        if (!request.facets) {
          return Promise.resolve({
            rows: [{ genome_id: "100.1", genome_name: "Page value" }],
            total: 1,
            facets: {},
            page: 1,
            pageSize: 200,
          });
        }
        if (request.facets.includes("host_name")) return hostName.promise;
        return Promise.resolve({
          rows: [],
          total: 1,
          facets: { genome_status: [{ value: "Complete", count: 1 }] },
          page: 1,
          pageSize: 1,
        });
      });
    const { result, rerender } = renderHook(
      ({ facetFields }: { facetFields: readonly string[] }) =>
        useResourceCollection({
          repository: data,
          resource: "genome",
          idField: "genome_id",
          fields: ["genome_id", "genome_name"],
          facetFields,
          prefetchNextPage: false,
          state: initialState,
          onStateChange: vi.fn(),
        }),
      {
        wrapper: sharedClientWrapper(),
        initialProps: { facetFields: ["genome_status"] as readonly string[] },
      },
    );
    await waitFor(() => {
      expect(result.current.facets).toEqual({
        genome_status: [{ value: "Complete", count: 1 }],
      });
    });

    // The user turns another facet on in the Facets menu.
    rerender({ facetFields: ["genome_status", "host_name"] });
    await waitFor(() => {
      expect(result.current.isFacetsLoading).toBe(true);
    });
    // Genome Status is still this scope's count, so nothing on screen is stale.
    expect(result.current.isFacetsRefreshing).toBe(false);
    expect(result.current.facets).toEqual({
      genome_status: [{ value: "Complete", count: 1 }],
    });
    expect(
      collection.mock.calls
        .filter(([, request]) => request.facets)
        .map(([, request]) => request.facets),
    ).toEqual([["genome_status"], ["host_name"]]);
    // The rows are not re-read for a facet change.
    expect(
      collection.mock.calls.filter(([, request]) => !request.facets),
    ).toHaveLength(1);

    act(() => {
      hostName.resolve({
        rows: [],
        total: 1,
        facets: { host_name: [{ value: "Human", count: 1 }] },
        page: 1,
        pageSize: 1,
      });
    });
    await waitFor(() => {
      expect(result.current.isFacetsLoading).toBe(false);
    });
    expect(result.current.facets).toEqual({
      genome_status: [{ value: "Complete", count: 1 }],
      host_name: [{ value: "Human", count: 1 }],
    });
  });

  it("reads the shown facets of one scope in one request, each kept as its own count", async () => {
    const data = repository();
    const collection = vi
      .spyOn(data, "collection")
      .mockImplementation((_resource, request) =>
        Promise.resolve({
          rows: request.facets
            ? []
            : [{ genome_id: "100.1", genome_name: "Page value" }],
          total: 1,
          // A field counted with no values is absent from the upstream answer.
          facets: request.facets
            ? { host_name: [{ value: "Human", count: 1 }] }
            : {},
          page: 1,
          pageSize: request.pageSize ?? 200,
        }),
      );
    const { result } = renderHook(
      () =>
        useResourceCollection({
          repository: data,
          resource: "genome",
          idField: "genome_id",
          fields: ["genome_id", "genome_name"],
          facetFields: ["genome_status", "host_name"],
          prefetchNextPage: false,
          state: initialState,
          onStateChange: vi.fn(),
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isFacetsLoading).toBe(false);
    });
    expect(result.current.facets).toEqual({
      genome_status: [],
      host_name: [{ value: "Human", count: 1 }],
    });
    const facetRequests = collection.mock.calls.filter(
      ([, request]) => request.facets,
    );
    expect(facetRequests).toEqual([
      [
        "genome",
        expect.objectContaining({ facets: ["genome_status", "host_name"] }),
        expect.any(AbortSignal),
      ],
    ]);
    // The settled counts keep their identity across renders.
    const settled = result.current.facets;
    await waitFor(() => {
      expect(result.current.facets.genome_status).toBe(settled.genome_status);
    });
  });

  /**
   * A repository whose facet reads stay pending until their signal aborts,
   * recording each one's signal.
   */
  function pendingFacetRepository() {
    const data = repository();
    const facetSignals: (AbortSignal | undefined)[] = [];
    vi.spyOn(data, "collection").mockImplementation(
      (_resource, request, signal) => {
        if (!request.facets)
          return Promise.resolve({
            rows: [{ genome_id: "100.1", genome_name: "Page value" }],
            total: 1,
            facets: {},
            page: 1,
            pageSize: 200,
          });
        facetSignals.push(signal);
        return new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            reject(signal.reason as Error);
          });
        });
      },
    );
    return { data, facetSignals };
  }

  it("aborts the shared facet read of a scope that is no longer shown", async () => {
    const { data, facetSignals } = pendingFacetRepository();
    const { result, rerender } = renderHook(
      ({ state }: { state: CollectionState }) =>
        useResourceCollection({
          repository: data,
          resource: "genome",
          idField: "genome_id",
          fields: ["genome_id", "genome_name"],
          facetFields: ["genome_status", "host_name"],
          prefetchNextPage: false,
          state,
          onStateChange: vi.fn(),
        }),
      { wrapper: sharedClientWrapper(), initialProps: { state: initialState } },
    );
    await waitFor(() => {
      expect(facetSignals).toHaveLength(1);
    });
    expect(facetSignals[0]).toBeInstanceOf(AbortSignal);
    expect(facetSignals[0]?.aborted).toBe(false);

    rerender({ state: { ...initialState, rql: "eq(genus,Escherichia)" } });
    await waitFor(() => {
      expect(facetSignals).toHaveLength(2);
    });
    expect(facetSignals[0]?.aborted).toBe(true);
    expect(facetSignals[1]?.aborted).toBe(false);
    // The abandoned read's abort is not this scope's error.
    expect(result.current.facetsError).toBeNull();
    expect(result.current.isFacetsLoading).toBe(true);
  });

  it("keeps reading the other facets of a scope when one is turned off mid-load", async () => {
    const data = repository();
    const facetRead = Promise.withResolvers<
      Awaited<ReturnType<DataRepository["collection"]>>
    >();
    const facetSignals: (AbortSignal | undefined)[] = [];
    vi.spyOn(data, "collection").mockImplementation(
      (_resource, request, signal) => {
        if (!request.facets)
          return Promise.resolve({
            rows: [{ genome_id: "100.1", genome_name: "Page value" }],
            total: 1,
            facets: {},
            page: 1,
            pageSize: 200,
          });
        facetSignals.push(signal);
        return facetRead.promise;
      },
    );
    const { result, rerender } = renderHook(
      ({ facetFields }: { facetFields: readonly string[] }) =>
        useResourceCollection({
          repository: data,
          resource: "genome",
          idField: "genome_id",
          fields: ["genome_id", "genome_name"],
          facetFields,
          prefetchNextPage: false,
          state: initialState,
          onStateChange: vi.fn(),
        }),
      {
        wrapper: sharedClientWrapper(),
        initialProps: {
          facetFields: ["genome_status", "host_name"] as readonly string[],
        },
      },
    );
    await waitFor(() => {
      expect(facetSignals).toHaveLength(1);
    });
    expect(facetSignals[0]).toBeInstanceOf(AbortSignal);

    // The user unpins Host Name while both counts load.
    rerender({ facetFields: ["genome_status"] });
    expect(facetSignals[0]?.aborted).toBe(false);

    act(() => {
      facetRead.resolve({
        rows: [],
        total: 1,
        facets: {
          genome_status: [{ value: "Complete", count: 1 }],
          host_name: [{ value: "Human", count: 1 }],
        },
        page: 1,
        pageSize: 1,
      });
    });
    await waitFor(() => {
      expect(result.current.facetStatuses).toEqual({ genome_status: "ready" });
    });
    expect(result.current.facets).toEqual({
      genome_status: [{ value: "Complete", count: 1 }],
    });
    expect(result.current.facetsError).toBeNull();
    expect(facetSignals).toHaveLength(1);
  });

  it("starts reading facets it is asked to prefetch, without reading fresh ones again", async () => {
    const data = repository();
    const collection = vi.spyOn(data, "collection");
    const { result, rerender } = renderHook(
      ({ facetFields }: { facetFields: readonly string[] }) =>
        useResourceCollection({
          repository: data,
          resource: "genome",
          idField: "genome_id",
          fields: ["genome_id", "genome_name"],
          facetFields,
          prefetchNextPage: false,
          state: { ...initialState, keyword: "coli" },
          onStateChange: vi.fn(),
        }),
      {
        wrapper: sharedClientWrapper(),
        initialProps: { facetFields: [] as readonly string[] },
      },
    );
    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });

    act(() => {
      result.current.prefetchFacets(["genome_status", "host_name"]);
    });
    const facetRequests = () =>
      collection.mock.calls.filter(([, request]) => request.facets);
    // Both fields go out in one request.
    await waitFor(() => {
      expect(facetRequests()).toHaveLength(1);
    });
    expect(facetRequests()).toContainEqual([
      "genome",
      expect.objectContaining({
        keyword: "coli",
        facets: ["genome_status", "host_name"],
      }),
      expect.any(AbortSignal),
    ]);

    // Opening the panel, or pointing at its button again, reuses those reads.
    act(() => {
      result.current.prefetchFacets(["genome_status", "host_name"]);
    });
    rerender({ facetFields: ["genome_status", "host_name"] });
    await waitFor(() => {
      expect(result.current.isFacetsLoading).toBe(false);
    });
    expect(facetRequests()).toHaveLength(1);
  });
});

describe("useResourceCollection facet scope", () => {
  it("counts facets over their own structural scope when one is given", async () => {
    const data = repository();
    const collection = vi.spyOn(data, "collection");
    renderHook(
      () =>
        useResourceCollection({
          repository: data,
          resource: "genome_feature",
          idField: "feature_id",
          fields: ["feature_id"],
          facetFields: ["annotation"],
          facetStructuralRql: () => "eq(feature_id,*)",
          prefetchNextPage: false,
          structuralRql: "eq(annotation,PATRIC)",
          state: {
            keyword: "Dnak",
            filters: { annotation: ["PATRIC"] },
            page: 1,
            sort: "unsorted",
          },
          onStateChange: vi.fn(),
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(collection).toHaveBeenCalledWith(
        "genome_feature",
        expect.objectContaining({
          facets: ["annotation"],
          keyword: "Dnak",
          rql: "eq(feature_id,*)",
        }),
        expect.any(AbortSignal),
      );
    });
    expect(collection).toHaveBeenCalledWith(
      "genome_feature",
      expect.objectContaining({
        page: 1,
        keyword: "Dnak",
        rql: "eq(annotation,PATRIC)",
      }),
      expect.any(AbortSignal),
    );
  });

  /** A repository whose facet reads answer one bucket per requested field. */
  function facetEchoRepository() {
    const data = repository();
    const collection = vi
      .spyOn(data, "collection")
      .mockImplementation((_resource, request) =>
        Promise.resolve({
          rows: request.facets ? [] : [{ feature_id: "fig|1.1.peg.1" }],
          total: 1,
          facets: Object.fromEntries(
            (request.facets ?? []).map((field) => [
              field,
              [{ value: `${field} value`, count: 1 }],
            ]),
          ),
          page: 1,
          pageSize: request.pageSize ?? 200,
        }),
      );
    const facetRequests = () =>
      collection.mock.calls
        .map(([, request]) => request)
        .filter((request) => request.facets);
    return { data, facetRequests };
  }

  it("reads a field with its own scope apart from the fields that share one", async () => {
    const { data, facetRequests } = facetEchoRepository();
    const { result } = renderHook(
      () =>
        useResourceCollection({
          repository: data,
          resource: "genome_feature",
          idField: "feature_id",
          fields: ["feature_id"],
          facetFields: ["annotation", "feature_type", "product"],
          // `annotation` is filtered, so its own counts leave that filter out.
          facetStructuralRql: (field) =>
            field === "annotation" ? undefined : "eq(annotation,PATRIC)",
          prefetchNextPage: false,
          structuralRql: "eq(annotation,PATRIC)",
          state: {
            rql: "eq(genome_id,83332.12)",
            filters: { annotation: ["PATRIC"] },
            page: 1,
            sort: "unsorted",
          },
          onStateChange: vi.fn(),
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.facetStatuses).toEqual({
        annotation: "ready",
        feature_type: "ready",
        product: "ready",
      });
    });
    expect(facetRequests()).toHaveLength(2);
    expect(facetRequests()).toEqual(
      expect.arrayContaining([
        // The explicit rql stays in every scope.
        expect.objectContaining({
          rql: "eq(genome_id,83332.12)",
          facets: ["annotation"],
        }),
        expect.objectContaining({
          rql: "and(eq(annotation,PATRIC),eq(genome_id,83332.12))",
          facets: ["feature_type", "product"],
        }),
      ]),
    );
    expect(result.current.facets).toEqual({
      annotation: [{ value: "annotation value", count: 1 }],
      feature_type: [{ value: "feature_type value", count: 1 }],
      product: [{ value: "product value", count: 1 }],
    });
  });

  it("reads fields whose scopes match in one batched request", async () => {
    const { data, facetRequests } = facetEchoRepository();
    const { result } = renderHook(
      () =>
        useResourceCollection({
          repository: data,
          resource: "genome_feature",
          idField: "feature_id",
          fields: ["feature_id"],
          facetFields: ["annotation", "feature_type"],
          facetStructuralRql: () => "eq(feature_id,*)",
          prefetchNextPage: false,
          structuralRql: "eq(annotation,PATRIC)",
          state: { filters: {}, page: 1, sort: "unsorted" },
          onStateChange: vi.fn(),
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(Object.keys(result.current.facets)).toHaveLength(2);
    });
    expect(facetRequests()).toEqual([
      expect.objectContaining({
        rql: "eq(feature_id,*)",
        facets: ["annotation", "feature_type"],
      }),
    ]);
  });

  it("reports each field loading, then ready, then stale while a new scope loads", async () => {
    const data = repository();
    type Answer = Awaited<ReturnType<DataRepository["collection"]>>;
    const firstScope = Promise.withResolvers<Answer>();
    const nextScope = Promise.withResolvers<Answer>();
    vi.spyOn(data, "collection").mockImplementation((_resource, request) => {
      if (!request.facets)
        return Promise.resolve({
          rows: [{ genome_id: "100.1", genome_name: "Page value" }],
          total: 1,
          facets: {},
          page: 1,
          pageSize: 200,
        });
      return request.keyword === "coli"
        ? nextScope.promise
        : firstScope.promise;
    });
    const answer = (count: number): Answer => ({
      rows: [],
      total: count,
      facets: {
        genome_status: [{ value: "Complete", count }],
        host_name: [{ value: "Human", count }],
      },
      page: 1,
      pageSize: 1,
    });
    const { result, rerender } = renderHook(
      ({
        state,
        facetFields,
      }: {
        state: CollectionState;
        facetFields: readonly string[];
      }) =>
        useResourceCollection({
          repository: data,
          resource: "genome",
          idField: "genome_id",
          fields: ["genome_id", "genome_name"],
          facetFields,
          prefetchNextPage: false,
          state,
          onStateChange: vi.fn(),
        }),
      {
        wrapper: sharedClientWrapper(),
        initialProps: {
          state: initialState,
          facetFields: ["genome_status"] as readonly string[],
        },
      },
    );

    // Nothing counted yet: no previous counts stand in.
    await waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });
    expect(result.current.facetStatuses).toEqual({ genome_status: "loading" });

    act(() => {
      firstScope.resolve(answer(9));
    });
    await waitFor(() => {
      expect(result.current.facetStatuses).toEqual({ genome_status: "ready" });
    });

    // A new scope: the old counts stay on screen, marked stale, while a field
    // counted for the first time has none to show.
    rerender({
      state: { ...initialState, keyword: "coli" },
      facetFields: ["genome_status", "host_name"],
    });
    await waitFor(() => {
      expect(result.current.facetStatuses).toEqual({
        genome_status: "stale",
        host_name: "loading",
      });
    });
    expect(result.current.facets).toEqual({
      genome_status: [{ value: "Complete", count: 9 }],
    });

    act(() => {
      nextScope.resolve(answer(2));
    });
    await waitFor(() => {
      expect(result.current.facetStatuses).toEqual({
        genome_status: "ready",
        host_name: "ready",
      });
    });
    expect(result.current.facets).toEqual({
      genome_status: [{ value: "Complete", count: 2 }],
      host_name: [{ value: "Human", count: 2 }],
    });
  });

  it("settles a field whose new scope's read fails instead of leaving it stale", async () => {
    const data = repository();
    const nextScope = Promise.withResolvers<
      Awaited<ReturnType<DataRepository["collection"]>>
    >();
    vi.spyOn(data, "collection").mockImplementation((_resource, request) => {
      if (!request.facets)
        return Promise.resolve({
          rows: [{ genome_id: "100.1", genome_name: "Page value" }],
          total: 1,
          facets: {},
          page: 1,
          pageSize: 200,
        });
      if (request.keyword === "coli") return nextScope.promise;
      return Promise.resolve({
        rows: [],
        total: 9,
        facets: { genome_status: [{ value: "Complete", count: 9 }] },
        page: 1,
        pageSize: 1,
      });
    });
    const { result, rerender } = renderHook(
      ({ state }: { state: CollectionState }) =>
        useResourceCollection({
          repository: data,
          resource: "genome",
          idField: "genome_id",
          fields: ["genome_id", "genome_name"],
          facetFields: ["genome_status"],
          prefetchNextPage: false,
          state,
          onStateChange: vi.fn(),
        }),
      { wrapper: sharedClientWrapper(), initialProps: { state: initialState } },
    );
    await waitFor(() => {
      expect(result.current.facetStatuses).toEqual({ genome_status: "ready" });
    });

    rerender({ state: { ...initialState, keyword: "coli" } });
    await waitFor(() => {
      expect(result.current.facetStatuses).toEqual({ genome_status: "stale" });
    });

    act(() => {
      nextScope.reject(new Error("Facet query timed out upstream."));
    });
    await waitFor(() => {
      expect(result.current.facetsError?.message).toBe(
        "Facet query timed out upstream.",
      );
    });
    // The previous scope's counts are not this scope's, so none are shown and
    // the error says why.
    expect(result.current.facetStatuses).toEqual({ genome_status: "ready" });
    expect(result.current.isFacetsRefreshing).toBe(false);
    expect(result.current.isFacetsLoading).toBe(false);
    expect(result.current.facets).toEqual({});
  });
});
