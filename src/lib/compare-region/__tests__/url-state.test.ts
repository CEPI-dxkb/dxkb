import { defaultCompareRegionSettings } from "../contract";
import {
  applyCompareRegionUrlState,
  compareRegionHref,
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
    ).toEqual({
      size: 50000,
      genomes: 20,
      method: "plfam",
      filter: "all",
      group: null,
    });
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

  it("reads and writes compare.group with a group filter", () => {
    const path = "/user@bvbrc/home/Genome Groups/My group";
    expect(
      parseCompareRegionUrlState(
        new URLSearchParams(`compare.filter=genomeGroup&compare.group=${encodeURIComponent(path)}`),
      ),
    ).toEqual({ ...defaultCompareRegionSettings, filter: "genomeGroup", group: path });

    const params = new URLSearchParams("tab=compare-region");
    applyCompareRegionUrlState(params, { ...defaultCompareRegionSettings, filter: "featureGroup", group: path });
    expect(params.get("compare.filter")).toBe("featureGroup");
    expect(params.get("compare.group")).toBe(path);

    applyCompareRegionUrlState(params, defaultCompareRegionSettings);
    expect(params.has("compare.group")).toBe(false);
    expect(params.has("compare.filter")).toBe(false);
  });

  it("falls back to the defaults for a group filter with no group", () => {
    expect(parseCompareRegionUrlState(new URLSearchParams("compare.filter=genomeGroup"))).toEqual(
      defaultCompareRegionSettings,
    );
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

describe("compareRegionHref", () => {
  it("opens another gene's comparison with no settings when they are the defaults", () => {
    expect(
      compareRegionHref("fig|1.1.peg.2", defaultCompareRegionSettings),
    ).toBe("/feature/fig%7C1.1.peg.2?tab=compare-region");
  });

  it("carries the settings that differ from the defaults, readably", () => {
    expect(
      compareRegionHref("fig|1.1.peg.2", {
        size: 50000,
        genomes: 20,
        method: "plfam",
        filter: "genomeGroup",
        group: "/u@bvbrc/home/Genome Groups/G1",
      }),
    ).toBe(
      "/feature/fig%7C1.1.peg.2?tab=compare-region&compare.size=50000&compare.genomes=20&compare.method=plfam&compare.filter=genomeGroup&compare.group=/u@bvbrc/home/Genome+Groups/G1",
    );
  });
});
