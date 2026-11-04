import { describe, expect, it } from "vitest";
import { gcWindowSize } from "../contract";
import { gcWindows } from "../gc";

describe("gcWindows", () => {
  it("scores each window's GC share and skew, as legacy getGCContent did", () => {
    expect(gcWindows("GGGCAATT", 4)).toEqual({ gc: [1, 0], skew: [0.5, 0] });
  });

  it("reads lowercase bases and a short last window", () => {
    expect(gcWindows("ggcca", 4)).toEqual({ gc: [1, 0], skew: [0, 0] });
  });

  it("rounds to four decimals", () => {
    expect(gcWindows("GCA", 3).gc).toEqual([0.6667]);
  });

  it("has no windows for an empty sequence", () => {
    expect(gcWindows("", 2000)).toEqual({ gc: [], skew: [] });
  });
});

describe("gcWindowSize", () => {
  it.each([
    [10_000, 20],
    [10_001, 50],
    [100_000, 50],
    [100_001, 2_000],
  ])("uses %i bp → %i nt windows", (length, size) => {
    expect(gcWindowSize(length)).toBe(size);
  });
});
