import { canonicalizeMemberTabQuery, firstSearchParam } from "../search-params";

describe("firstSearchParam", () => {
  it("returns a scalar value as-is", () => {
    expect(firstSearchParam({ tab: "overview" }, "tab")).toBe("overview");
  });
  it("returns the first element of an array value", () => {
    expect(firstSearchParam({ tab: ["a", "b"] }, "tab")).toBe("a");
  });
  it("returns undefined for a missing key", () => {
    expect(firstSearchParam({ other: "x" }, "tab")).toBeUndefined();
  });
  it("returns undefined when params is undefined", () => {
    expect(firstSearchParam(undefined, "tab")).toBeUndefined();
  });
  it("returns undefined for an empty array value", () => {
    expect(firstSearchParam({ tab: [] }, "tab")).toBeUndefined();
  });
});

describe("canonicalizeMemberTabQuery", () => {
  it("removes the default tab and preserves repeated unrelated params", () => {
    expect(
      canonicalizeMemberTabQuery(
        { tab: "overview", source: ["search", "history"] },
        "overview",
      ),
    ).toBe("source=search&source=history");
  });

  it("normalizes repeated tab values to one non-default tab", () => {
    expect(
      canonicalizeMemberTabQuery(
        { tab: ["biosets", "overview"], source: "search" },
        "biosets",
      ),
    ).toBe("source=search&tab=biosets");
  });

  it("does not redirect an already canonical non-default tab", () => {
    expect(
      canonicalizeMemberTabQuery(
        { tab: "biosets", source: "search" },
        "biosets",
      ),
    ).toBeNull();
  });
});
