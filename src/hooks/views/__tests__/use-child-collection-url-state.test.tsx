import { renderHook } from "@testing-library/react";
import { childCollectionOptions } from "@/lib/views/child-collection-state";
import {
  resetChildCollectionPage,
  useChildCollectionUrlState,
} from "../use-child-collection-url-state";

vi.mock("next/navigation", () => ({
  usePathname: () => "/genome/1.1",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const options = childCollectionOptions(
  [{ id: "start" }, { id: "product" }],
  [{ field: "feature_type" }],
  "start:asc",
);

const location = () =>
  window.location.pathname + window.location.search + window.location.hash;

beforeEach(() => {
  window.history.replaceState(
    null,
    "",
    "/genome/1.1?tab=features&features.page=2&domains.page=5#legacy",
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useChildCollectionUrlState", () => {
  it("reads its own state from the prefixed params", () => {
    const { result } = renderHook(() =>
      useChildCollectionUrlState("features", options),
    );
    expect(result.current[0]).toMatchObject({ page: 2, sort: "start:asc" });
  });

  it("pushes a history entry under its prefix, keeping other params and the hash", () => {
    const pushState = vi.spyOn(window.history, "pushState");
    const { result } = renderHook(() =>
      useChildCollectionUrlState("features", options),
    );
    result.current[1]({
      filters: { feature_type: ["CDS"] },
      page: 3,
      sort: "product:desc",
    });
    expect(pushState).toHaveBeenCalledWith(
      null,
      "",
      "/genome/1.1?tab=features&domains.page=5&features.feature_type=CDS&features.page=3&features.sort=product:desc#legacy",
    );
  });

  it("builds the address from the live pathname, not the last render's", () => {
    // usePathname above says /genome/1.1, as it does in a render that predates
    // a navigation to another genome. The hook must not build from it.
    window.history.replaceState(
      null,
      "",
      "/genome/2.2?tab=features&features.page=2#legacy",
    );
    const pushState = vi.spyOn(window.history, "pushState");
    const { result } = renderHook(() =>
      useChildCollectionUrlState("features", options),
    );
    result.current[1]({ filters: {}, page: 3, sort: "start:asc" });
    expect(pushState).toHaveBeenCalledWith(
      null,
      "",
      "/genome/2.2?tab=features&features.page=3#legacy",
    );
  });

  it("replaces the entry when asked to", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(() =>
      useChildCollectionUrlState("features", options),
    );
    result.current[1](
      { filters: {}, page: 1, sort: "start:asc", keyword: "dnaK" },
      "replace",
    );
    expect(replaceState).toHaveBeenLastCalledWith(
      null,
      "",
      "/genome/1.1?tab=features&domains.page=5&features.keyword=dnaK#legacy",
    );
  });

  it("keeps both of two tables' writes made in one tick", () => {
    // Both hooks still hold the URL from before either write, as they do while
    // Next applies a History API write inside a transition.
    const features = renderHook(() =>
      useChildCollectionUrlState("features", options),
    );
    const domains = renderHook(() =>
      useChildCollectionUrlState("domains", options),
    );
    features.result.current[1]({ filters: {}, page: 4, sort: "start:asc" });
    domains.result.current[1]({ filters: {}, page: 6, sort: "start:asc" });
    expect(location()).toBe(
      "/genome/1.1?tab=features&features.page=4&domains.page=6#legacy",
    );
  });
});

describe("useChildCollectionUrlState history entries", () => {
  // One user action is one Back step. A sort click reports a page reset and then
  // the sort in the same event, and a keyword commit resets the page and then
  // writes the state.
  it("gives two writes in one task a single entry holding the final state", () => {
    const pushState = vi.spyOn(window.history, "pushState");
    const replaceState = vi.spyOn(window.history, "replaceState");
    const lengthBefore = window.history.length;
    const { result } = renderHook(() =>
      useChildCollectionUrlState("features", options),
    );

    result.current[1]({ filters: {}, page: 1, sort: "start:asc" });
    result.current[1]({ filters: {}, page: 1, sort: "product:asc" });

    expect(pushState).toHaveBeenCalledOnce();
    expect(replaceState).toHaveBeenCalledOnce();
    expect(window.history.length).toBe(lengthBefore + 1);
    expect(location()).toBe(
      "/genome/1.1?tab=features&domains.page=5&features.sort=product:asc#legacy",
    );
  });

  it("writes nothing for a URL the address bar already holds", () => {
    const pushState = vi.spyOn(window.history, "pushState");
    const replaceState = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(() =>
      useChildCollectionUrlState("features", options),
    );

    result.current[1]({ filters: {}, page: 2, sort: "start:asc" });
    result.current[1]({ filters: {}, page: 2, sort: "start:asc" }, "replace");

    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("does not treat a reordered query as a new URL", () => {
    window.history.replaceState(
      null,
      "",
      "/genome/1.1?features.page=2&tab=features",
    );
    const pushState = vi.spyOn(window.history, "pushState");
    const { result } = renderHook(() =>
      useChildCollectionUrlState("features", options),
    );

    result.current[1]({ filters: {}, page: 2, sort: "start:asc" });

    expect(pushState).not.toHaveBeenCalled();
  });

  it("keeps a skipped write from using up the task's push", () => {
    const pushState = vi.spyOn(window.history, "pushState");
    const { result } = renderHook(() =>
      useChildCollectionUrlState("features", options),
    );

    // The address bar already holds page 2, so the first call is skipped; the
    // second is the real change and still gets the task's one push.
    result.current[1]({ filters: {}, page: 2, sort: "start:asc" });
    result.current[1]({ filters: {}, page: 2, sort: "product:desc" });

    expect(pushState).toHaveBeenCalledOnce();
  });

  it("pushes again for a write in a later task", async () => {
    const pushState = vi.spyOn(window.history, "pushState");
    const { result } = renderHook(() =>
      useChildCollectionUrlState("features", options),
    );

    result.current[1]({ filters: {}, page: 3, sort: "start:asc" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    result.current[1]({ filters: {}, page: 4, sort: "start:asc" });

    expect(pushState).toHaveBeenCalledTimes(2);
  });

  it("lets an explicit replace leave the task's push unused", () => {
    const pushState = vi.spyOn(window.history, "pushState");
    const replaceState = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(() =>
      useChildCollectionUrlState("features", options),
    );

    result.current[1](
      { filters: {}, page: 1, sort: "start:asc", keyword: "dnaK" },
      "replace",
    );
    result.current[1]({ filters: {}, page: 3, sort: "start:asc" });

    expect(replaceState).toHaveBeenCalledOnce();
    expect(pushState).toHaveBeenCalledOnce();
  });
});

describe("resetChildCollectionPage", () => {
  it("drops the page param without adding a history entry", () => {
    const pushState = vi.spyOn(window.history, "pushState");
    const replaceState = vi.spyOn(window.history, "replaceState");
    resetChildCollectionPage("features");
    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/genome/1.1?tab=features&domains.page=5#legacy",
    );
  });

  it("leaves the URL alone when there is no page to drop", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    resetChildCollectionPage("sequences");
    expect(replaceState).not.toHaveBeenCalled();
  });
});
