import { defaultCompareRegionSettings } from "../contract";
import {
  applyCompareRegionUrlState,
  parseCompareRegionUrlState,
  writeCompareRegionUrlState,
} from "../url-state";

describe("Compare Region URL state", () => {
  it("reads the defaults from a bare URL", () => {
    expect(parseCompareRegionUrlState(new URLSearchParams())).toEqual(
      defaultCompareRegionSettings,
    );
  });

  it("reads the compare.* params", () => {
    expect(
      parseCompareRegionUrlState(
        new URLSearchParams(
          "compare.size=50000&compare.genomes=20&compare.method=plfam&compare.filter=all",
        ),
      ),
    ).toEqual({ size: 50000, genomes: 20, method: "plfam", filter: "all" });
  });

  it("falls back to every default when a hand-edited value is not offered", () => {
    expect(
      parseCompareRegionUrlState(
        new URLSearchParams("compare.size=12345&compare.method=plfam"),
      ),
    ).toEqual(defaultCompareRegionSettings);
  });

  it("writes only what differs from the defaults and keeps other params", () => {
    const params = new URLSearchParams("tab=compare-region&compare.size=50000");
    applyCompareRegionUrlState(params, {
      ...defaultCompareRegionSettings,
      genomes: 20,
    });
    expect([...params]).toEqual([
      ["tab", "compare-region"],
      ["compare.genomes", "20"],
    ]);
  });

  it("replaces the history entry rather than adding one", () => {
    window.history.replaceState(null, "", "/feature/PATRIC.1?tab=compare-region");
    const replace = vi.spyOn(window.history, "replaceState");
    writeCompareRegionUrlState({ ...defaultCompareRegionSettings, filter: "all" });
    expect(replace).toHaveBeenCalledWith(
      null,
      "",
      "/feature/PATRIC.1?tab=compare-region&compare.filter=all",
    );
    replace.mockRestore();
  });
});
