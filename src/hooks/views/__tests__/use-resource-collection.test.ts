import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { DataRepository } from "@/lib/data-api";
import type { CollectionState } from "@/lib/views/collection-state";
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

  it("re-reads the counts for a changed facet set, keeping the previous ones marked refreshing", async () => {
    const data = repository();
    const widerSet = Promise.withResolvers<
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
        if (request.facets.includes("host_name")) return widerSet.promise;
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
      expect(result.current.isFacetsRefreshing).toBe(true);
    });
    expect(result.current.facets).toEqual({
      genome_status: [{ value: "Complete", count: 1 }],
    });
    expect(
      collection.mock.calls
        .filter(([, request]) => request.facets)
        .map(([, request]) => request.facets),
    ).toEqual([["genome_status"], ["genome_status", "host_name"]]);
    // The rows are not re-read for a facet change.
    expect(
      collection.mock.calls.filter(([, request]) => !request.facets),
    ).toHaveLength(1);

    act(() => {
      widerSet.resolve({
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
      expect(result.current.isFacetsRefreshing).toBe(false);
    });
    expect(result.current.facets).toHaveProperty("host_name", [
      { value: "Human", count: 1 },
    ]);
  });
});
