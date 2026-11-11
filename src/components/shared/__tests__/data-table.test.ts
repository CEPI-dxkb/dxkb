import { computeShiftRangeIds, estimateHeaderWidth } from "../data-table-utils";

const rows = ["a", "b", "c", "d", "e"].map((id) => ({ id }));

describe("computeShiftRangeIds", () => {
  it("returns the inclusive range when anchor precedes target", () => {
    expect(computeShiftRangeIds(rows, "b", "d")).toEqual(["b", "c", "d"]);
  });

  it("is order-independent (target precedes anchor)", () => {
    expect(computeShiftRangeIds(rows, "d", "b")).toEqual(["b", "c", "d"]);
  });

  it("returns a single id when anchor equals target", () => {
    expect(computeShiftRangeIds(rows, "c", "c")).toEqual(["c"]);
  });

  it("spans the full list from first to last", () => {
    expect(computeShiftRangeIds(rows, "a", "e")).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
  });

  it("returns empty when the anchor id is not present", () => {
    expect(computeShiftRangeIds(rows, "z", "c")).toEqual([]);
  });

  it("returns empty when the target id is not present", () => {
    expect(computeShiftRangeIds(rows, "c", "z")).toEqual([]);
  });
});

describe("estimateHeaderWidth", () => {
  it("is deterministic and SSR-safe (pure string math, no canvas/document)", () => {
    expect(estimateHeaderWidth("Genome Name")).toBe(
      estimateHeaderWidth("Genome Name"),
    );
    expect(typeof estimateHeaderWidth("Genome Name")).toBe("number");
  });

  it("sizes by the longest word (headers wrap), not the whole label", () => {
    expect(estimateHeaderWidth("Collection Year")).toBeGreaterThan(
      estimateHeaderWidth("Genome Name"),
    );
  });

  it("clamps to [60, 250]", () => {
    expect(estimateHeaderWidth("A")).toBe(60);
    expect(estimateHeaderWidth("x".repeat(100))).toBe(250);
  });
});
