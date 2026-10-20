import { act, renderHook, waitFor } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";

import { createQueryClientWrapper } from "@/test-helpers/react";

import {
  taxonomyLookupState,
  type TaxonomyLookupQuery,
} from "../taxonomy-lookup-state";

const outage = new Error("BV-BRC Taxonomy API error: 503 Service Unavailable");

function lookupQuery(
  overrides: Partial<TaxonomyLookupQuery>,
): TaxonomyLookupQuery {
  return {
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

describe("taxonomyLookupState", () => {
  it("shows a first search as loading, without an error", () => {
    const state = taxonomyLookupState(
      lookupQuery({ isLoading: true, isFetching: true }),
    );

    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
  });

  it("shows a failed search as its prefixed reason, not loading", () => {
    const state = taxonomyLookupState(
      lookupQuery({ isError: true, error: outage }),
    );

    expect(state.loading).toBe(false);
    expect(state.error).toBe(
      "Taxonomy search unavailable: BV-BRC Taxonomy API error: 503 Service Unavailable",
    );
  });

  it("shows a Retry of a failed search that kept data as loading, not the stale error", () => {
    // TanStack keeps a query that has data in "error" while it refetches,
    // so isLoading stays false.
    const state = taxonomyLookupState(
      lookupQuery({ isError: true, isFetching: true, error: outage }),
    );

    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
  });

  it("runs the search again on retry", () => {
    const refetch = vi.fn();

    taxonomyLookupState(lookupQuery({ refetch })).retry();

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows a real query's Retry after a failed refetch of cached results as loading", async () => {
    let call = 0;
    const queryFn = () => {
      call += 1;
      if (call === 1) return Promise.resolve(["Escherichia coli"]);
      if (call === 2) return Promise.reject(outage);
      // The Retry stays in flight, so its state can be read.
      return new Promise<string[]>(() => undefined);
    };
    // Built during render, as the selectors build it.
    const { result } = renderHook(
      () => {
        const query = useQuery({ queryKey: ["taxonomy-lookup"], queryFn });
        return { query, lookup: taxonomyLookupState(query) };
      },
      { wrapper: createQueryClientWrapper() },
    );
    await waitFor(() => {
      expect(result.current.lookup.loading).toBe(false);
    });

    act(() => {
      result.current.lookup.retry();
    });
    await waitFor(() => {
      expect(result.current.lookup.error).not.toBeNull();
    });

    act(() => {
      result.current.lookup.retry();
    });
    await waitFor(() => {
      expect(result.current.lookup.loading).toBe(true);
    });

    expect(result.current.query).toEqual(
      expect.objectContaining({ isError: true, isLoading: false }),
    );
    expect(result.current.lookup.error).toBeNull();
  });
});
