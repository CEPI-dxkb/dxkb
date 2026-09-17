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
      "/protein-feature?tab=details&rql=eq%28public%2Cfalse%29",
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
      "/protein-feature?tab=details&keep=a&keep=b&keyword=flu&host=human&page=5&sort=year%3Adesc",
      { scroll: false },
    );
  });
});
