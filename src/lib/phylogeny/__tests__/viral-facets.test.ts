import type { PhyloFamilyBlock } from "@/lib/services/organisms/phylogeny";
import {
  choiceKey,
  filterViralTrees,
  flattenViralTrees,
  isUnavailable,
  parseSegment,
  pruneViralFilters,
  segmentColor,
  segmentRows,
  sortedSegments,
  viewerLabel,
  viralFacetCounts,
  type ViralFilters,
  type ViralTreeChoice,
} from "../viral-facets";

const noFilters: ViralFilters = { strain: null, viewer: null, segments: new Set() };

const block: PhyloFamilyBlock = {
  order: ["b", "a"],
  groups: [
    { key: "a", title: "Strain A", archaeopteryx: [{ name: "segment 7 (M1, M2)", path: "/a.xml" }] },
    { key: "b", title: "Strain B", archaeopteryx: [{ name: "All concatenated", path: "/b.xml" }], nextstrain: [{ name: "segment 4 (HA)", path: "/b.json" }] },
  ],
};

describe("viral facets", () => {
  it.each([
    ["All concatenated", "All"],
    ["segment 7 (M1, M2)", "M1"],
    ["segment 8 (NS1, NEP)", "NS1"],
    ["segment without detail", null],
  ])("parses %s", (name, segment) => { expect(parseSegment(name)).toBe(segment); });

  it("flattens in configured group order and sorts known segments", () => {
    const trees = flattenViralTrees(block);
    expect(trees.map(tree => tree.groupKey)).toEqual(["b", "b", "a"]);
    expect(sortedSegments(trees)).toEqual(["All", "HA", "M1"]);
  });

  it("filters and prunes values invalidated by another facet", () => {
    const trees = flattenViralTrees(block);
    const filters = pruneViralFilters(trees, {
      strain: "a",
      viewer: "nextstrain",
      segments: new Set(["HA", "M1"]),
    });
    expect(filters.viewer).toBeNull();
    expect([...filters.segments]).toEqual(["M1"]);
    expect(filterViralTrees(trees, filters).map(tree => tree.ref.path)).toEqual(["/a.xml"]);
  });
});

describe("viralFacetCounts", () => {
  const trees = flattenViralTrees(block);

  it("counts every tree when nothing is filtered", () => {
    const counts = viralFacetCounts(trees, noFilters);
    expect(counts.allStrains).toBe(3);
    expect(counts.allViewers).toBe(3);
    expect(counts.strain("a")).toBe(1);
    expect(counts.viewer("archaeopteryx")).toBe(2);
    expect(counts.viewer("nextstrain")).toBe(1);
    expect(counts.segment("HA")).toBe(1);
  });

  it("returns zero for a viewer with no trees under the chosen strain", () => {
    const counts = viralFacetCounts(trees, { ...noFilters, strain: "a" });
    expect(counts.viewer("nextstrain")).toBe(0);
    expect(counts.viewer("archaeopteryx")).toBe(1);
    expect(counts.allViewers).toBe(1);
  });

  it("narrows segment counts by both strain and viewer", () => {
    const strainOnly = viralFacetCounts(trees, { ...noFilters, strain: "b" });
    expect([strainOnly.segment("All"), strainOnly.segment("HA")]).toEqual([1, 1]);

    const withViewer = viralFacetCounts(trees, { ...noFilters, strain: "b", viewer: "nextstrain" });
    expect([withViewer.segment("All"), withViewer.segment("HA")]).toEqual([0, 1]);
  });

  it("ignores the segment filter so a checked segment never zeroes its own count", () => {
    // Segments are a union: checking HA must not make the others read 0 and disable themselves.
    const counts = viralFacetCounts(trees, { ...noFilters, segments: new Set(["HA"]) });
    expect(counts.segment("M1")).toBe(1);
    expect(counts.segment("All")).toBe(1);
  });

  it("leaves strain counts unconstrained by the chosen viewer", () => {
    const counts = viralFacetCounts(trees, { ...noFilters, viewer: "nextstrain" });
    expect(counts.strain("a")).toBe(1);
    expect(counts.strain("b")).toBe(2);
  });

  it("reports zero for unknown keys and handles an empty tree list", () => {
    expect(viralFacetCounts(trees, noFilters).strain("missing")).toBe(0);
    expect(viralFacetCounts(trees, noFilters).segment("ZZ")).toBe(0);

    const empty = viralFacetCounts([], noFilters);
    expect([empty.allStrains, empty.allViewers, empty.viewer("archaeopteryx")]).toEqual([0, 0, 0]);
  });

  it("agrees with pruneViralFilters: a zero-count option is one prune would drop", () => {
    const filters: ViralFilters = { ...noFilters, strain: "a" };
    expect(viralFacetCounts(trees, filters).viewer("nextstrain")).toBe(0);
    expect(pruneViralFilters(trees, { ...filters, viewer: "nextstrain" }).viewer).toBeNull();
  });
});

describe("choiceKey", () => {
  it("joins viewer and path so it is unique per choice", () => {
    const choice = flattenViralTrees(block)[0];
    expect(choiceKey(choice)).toBe(`${choice.viewer}:${choice.ref.path}`);
  });
});

describe("isUnavailable", () => {
  const nextstrainChoice: ViralTreeChoice = {
    groupKey: "b",
    groupTitle: "Strain B",
    viewer: "nextstrain",
    segment: "HA",
    ref: { name: "segment 4 (HA)", path: "Influenza-A-Virus/H3N2/HA" },
  };

  it("is never unavailable for archaeopteryx", () => {
    expect(isUnavailable({ ...nextstrainChoice, viewer: "archaeopteryx" }, new Set())).toBe(false);
  });

  it("is unavailable when the canonical dataset id is missing from inventory", () => {
    expect(isUnavailable(nextstrainChoice, new Set())).toBe(true);
    expect(isUnavailable(nextstrainChoice, new Set(["Influenza-A-Virus/H3N2/HA"]))).toBe(false);
  });

  it("is unavailable when the path has no canonical dataset id", () => {
    const invalid: ViralTreeChoice = { ...nextstrainChoice, ref: { name: "x", path: "//example.org/tree" } };
    expect(isUnavailable(invalid, new Set(["//example.org/tree"]))).toBe(true);
  });
});

describe("viewerLabel", () => {
  it("labels each viewer for display", () => {
    expect(viewerLabel.archaeopteryx).toBe("Archaeopteryx");
    expect(viewerLabel.nextstrain).toBe("Auspice");
  });
});

describe("segmentColor", () => {
  it("maps a known segment to a stable chart variable", () => {
    expect(segmentColor("HA")).toBe(segmentColor("HA"));
    expect(segmentColor("HA")).toMatch(/^var\(--chart-\d+\)$/);
  });

  it("falls back to a hashed slot for an unrecognized segment", () => {
    expect(segmentColor("ZZ")).toMatch(/^var\(--chart-\d+\)$/);
  });

  it("uses the muted foreground token when there is no segment", () => {
    expect(segmentColor(null)).toBe("var(--muted-foreground)");
  });
});

describe("segmentRows", () => {
  it("groups trees into one row per strain and segment, collapsing viewers", () => {
    const trees = flattenViralTrees(block);
    const rows = segmentRows(trees);

    expect(rows.map(row => [row.strainKey, row.segment])).toEqual([
      ["b", "All"],
      ["b", "HA"],
      ["a", "M1"],
    ]);
    const haRow = rows.find(row => row.segment === "HA");
    expect(haRow?.choices).toHaveLength(1);
    expect(haRow?.choices[0]?.viewer).toBe("nextstrain");
  });

  it("keeps distinct non-segmented references in separate rows", () => {
    const trees = flattenViralTrees({
      groups: [{
        key: "ebola",
        title: "Ebola",
        nextstrain: [
          { name: "100 samples", path: "Orthoebolavirus/100" },
          { name: "500 samples", path: "Orthoebolavirus/500" },
        ],
      }],
    });

    const rows = segmentRows(trees);
    expect(rows).toHaveLength(2);
    expect(rows.map(row => row.choices.map(choice => choice.ref.path))).toEqual([
      ["Orthoebolavirus/100"],
      ["Orthoebolavirus/500"],
    ]);
  });

  it("returns no rows for an empty tree list", () => {
    expect(segmentRows([])).toEqual([]);
  });
});
