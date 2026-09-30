import { act, renderHook } from "@testing-library/react";
import {
  parseCollectionState,
  serializeCollectionState,
  updateCollectionSearchParams,
} from "@/lib/views/collection-state";
import { resourceCollectionPageSize } from "../collection-state";
import { useCollectionUrlState } from "../use-collection-url-state";

const navigation = vi.hoisted(() => ({
  pathname: "/protein-feature",
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
  useSearchParams: () => navigation.searchParams,
}));

const options = {
  defaultSort: "name:asc",
  sortAllowlist: ["name:asc", "year:desc"] as const,
  friendlyFilters: ["taxon_id", "host"] as const,
};

describe("view collection state exports", () => {
  it("pins the shared page size at 200", () => {
    expect(resourceCollectionPageSize).toBe(200);
  });

  it("keeps explicit rql independent from keyword and ahead of friendly filters", () => {
    expect(
      parseCollectionState(
        {
          keyword: "flu",
          rql: "eq(host,human)",
          taxon_id: "123",
          page: "3",
          sort: "year:desc",
        },
        options,
      ),
    ).toEqual({
      keyword: "flu",
      rql: "eq(host,human)",
      page: 3,
      sort: "year:desc",
      filters: {},
    });
  });

  it("omits canonical defaults and resets paging when filters change", () => {
    const state = parseCollectionState({ host: "human" }, options);
    expect(serializeCollectionState(state, options).toString()).toBe(
      "host=human",
    );
    expect(
      updateCollectionSearchParams(
        { page: "8", host: "human", tab: "details" },
        { filters: { host: ["swine"] } },
        options,
      ).toString(),
    ).toBe("tab=details&host=swine");
  });

  it("removes an opted-in legacy RQL filter during an immediate update", () => {
    navigation.searchParams = new URLSearchParams(
      "filter=eq%28public%2Ctrue%29&tab=details",
    );
    const legacyOptions = { ...options, legacyRqlFilter: true };
    const { result } = renderHook(() => useCollectionUrlState(legacyOptions));

    act(() => {
      result.current[1]({
        ...result.current[0],
        rql: "eq(public,false)",
      });
    });

    expect(navigation.push).toHaveBeenCalledWith(
      "/protein-feature?tab=details&rql=eq(public,false)",
      { scroll: false },
    );
  });

  it("preserves a non-RQL filter during an immediate update", () => {
    navigation.searchParams = new URLSearchParams(
      "filter=protein&tab=details",
    );
    const legacyOptions = { ...options, legacyRqlFilter: true };
    const { result } = renderHook(() => useCollectionUrlState(legacyOptions));

    act(() => {
      result.current[1]({ ...result.current[0], page: 2 });
    });

    expect(navigation.push).toHaveBeenCalledWith(
      "/protein-feature?filter=protein&tab=details&page=2",
      { scroll: false },
    );
  });

  it("delegates full-state replacement to the pure module without resetting pagination", () => {
    // A smoke test that setState no longer reimplements the managed-key merge
    // inline: it goes through replaceCollectionSearchParams, which (unlike
    // the incremental update path) never resets page — the caller already
    // owns the complete next state, including an explicit page far from 1.
    navigation.searchParams = new URLSearchParams(
      "page=9&tab=details&keep=a&keep=b",
    );
    const { result } = renderHook(() => useCollectionUrlState(options));

    act(() => {
      result.current[1]({
        keyword: "flu",
        filters: { host: ["human"] },
        page: 5,
        sort: "year:desc",
      });
    });

    expect(navigation.push).toHaveBeenCalledWith(
      "/protein-feature?tab=details&keep=a&keep=b&keyword=flu&host=human&page=5&sort=year:desc",
      { scroll: false },
    );
  });
});

describe("useCollectionUrlState nested tables", () => {
  beforeEach(() => {
    navigation.push.mockClear();
  });

  it("clears nested-table params when the page's own query changes", () => {
    // A new parent query is a new scope for every nested table: page 3 of the
    // old scope may not exist in the new one.
    navigation.searchParams = new URLSearchParams(
      "tab=features&host=human&features.page=3&features.sort=start:desc",
    );
    const { result } = renderHook(() => useCollectionUrlState(options));

    act(() => {
      result.current[1]({ filters: { host: ["bat"] }, page: 1, sort: "name:asc" });
    });

    expect(navigation.push).toHaveBeenCalledWith(
      "/protein-feature?tab=features&host=bat",
      { scroll: false },
    );
  });

  it("does not mistake a nested table's params for its own state", () => {
    navigation.searchParams = new URLSearchParams(
      "features.page=3&features.sort=year:desc&features.host=human",
    );
    const { result } = renderHook(() => useCollectionUrlState(options));
    expect(result.current[0]).toMatchObject({ filters: {}, page: 1, sort: "name:asc" });
  });
});

describe("useCollectionUrlState canonical replace", () => {
  beforeEach(() => {
    navigation.push.mockClear();
    navigation.replace.mockClear();
  });

  it("does not replace a canonical URL whose RQL is already readable", () => {
    navigation.searchParams = new URLSearchParams("rql=eq(public,false)");
    renderHook(() => useCollectionUrlState(options));
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("replaces a non-canonical URL with readable query text", () => {
    navigation.searchParams = new URLSearchParams("rql=eq(public,false)&page=1");
    renderHook(() => useCollectionUrlState(options));
    expect(navigation.replace).toHaveBeenCalledWith(
      "/protein-feature?rql=eq(public,false)",
      { scroll: false },
    );
  });
});
