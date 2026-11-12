import type { PhyloFamilyBlock } from "@/lib/services/organisms/phylogeny";
import {
  buildTreeRows,
  choiceKey,
  filterViralTrees,
  flattenViralTrees,
  isUnavailable,
  parseSegment,
  pruneViralFilters,
  segmentLabel,
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

describe("segmentLabel", () => {
  it("names the concatenated tree so it does not read as 'no filter'", () => {
    expect(segmentLabel("All")).toBe("Concatenated");
    expect(segmentLabel("HA")).toBe("HA");
  });
});

describe("buildTreeRows", () => {
  const ready = (ids: string[]) => ({ status: "ready" as const, ids: new Set(ids) });

  it("orders rows by strain, then segment, with one slot per viewer", () => {
    const rows = buildTreeRows(flattenViralTrees(block), ready([]));

    expect(rows.map(row => [row.strainKey, row.segment])).toEqual([
      ["b", "All"],
      ["b", "HA"],
      ["a", "M1"],
    ]);
    const ha = rows.find(row => row.segment === "HA");
    expect(ha?.slots.archaeopteryx).toEqual({ state: "none" });
    expect(ha?.slots.nextstrain.state).toBe("missing");
  });

  it("pairs same-named unsegmented trees across viewers into one row", () => {
    const rows = buildTreeRows(
      flattenViralTrees({
        groups: [{
          key: "ebola",
          title: "Ebola",
          archaeopteryx: [
            { name: "Ebola - 100", path: "/100.xml", metadata: "/100.tar.gz" },
            { name: "Ebola - 500", path: "/500.xml" },
          ],
          nextstrain: [
            { name: "Ebola - 100", path: "Orthoebolavirus/100" },
            { name: "Ebola - 500", path: "Orthoebolavirus/500" },
          ],
        }],
      }),
      ready(["Orthoebolavirus/100"]),
    );

    expect(rows.map(row => row.name)).toEqual(["Ebola - 100", "Ebola - 500"]);
    expect(rows[0]?.metadata).toBe("/100.tar.gz");
    expect(rows.map(row => [row.slots.archaeopteryx.state, row.slots.nextstrain.state])).toEqual([
      ["open", "open"],
      ["open", "missing"],
    ]);
  });

  it("keeps distinct unsegmented trees of one viewer in separate rows", () => {
    const rows = buildTreeRows(
      flattenViralTrees({
        groups: [{
          key: "ebola",
          title: "Ebola",
          nextstrain: [
            { name: "100 samples", path: "Orthoebolavirus/100" },
            { name: "500 samples", path: "Orthoebolavirus/500" },
          ],
        }],
      }),
      ready(["Orthoebolavirus/100", "Orthoebolavirus/500"]),
    );

    expect(rows).toHaveLength(2);
    expect(rows.map(row => row.slots.archaeopteryx.state)).toEqual(["none", "none"]);
  });

  it("keeps a second tree for the same strain and segment instead of dropping it", () => {
    const rows = buildTreeRows(
      flattenViralTrees({
        groups: [{
          key: "h3n2",
          title: "H3N2",
          archaeopteryx: [
            { name: "HA 100 (HA)", path: "/ha-100.xml" },
            { name: "HA 500 (HA)", path: "/ha-500.xml" },
          ],
        }],
      }),
      ready([]),
    );

    expect(rows.map(row => row.name)).toEqual(["HA 100 (HA)", "HA 500 (HA)"]);
  });

  it("marks Auspice slots as checking or unconfirmed until the inventory is known", () => {
    const trees = flattenViralTrees(block);
    const ha = (inventory: Parameters<typeof buildTreeRows>[1]) =>
      buildTreeRows(trees, inventory).find(row => row.segment === "HA")?.slots.nextstrain.state;

    expect(ha({ status: "pending" })).toBe("checking");
    expect(ha({ status: "error", message: "down" })).toBe("unconfirmed");
    expect(buildTreeRows(trees, { status: "pending" }).find(row => row.segment === "All")?.slots.archaeopteryx.state).toBe("open");
  });

  it("returns no rows for an empty tree list", () => {
    expect(buildTreeRows([], ready([]))).toEqual([]);
  });
});
