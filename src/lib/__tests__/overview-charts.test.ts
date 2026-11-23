import {
  emptyOverviewHiddenCharts,
  overviewHiddenChartsLimit,
  withChartHidden,
} from "../overview-charts";

describe("emptyOverviewHiddenCharts", () => {
  it("hides nothing for either view type, in a fresh object each call", () => {
    expect(emptyOverviewHiddenCharts()).toStrictEqual({ genome: [], taxon: [] });
    expect(emptyOverviewHiddenCharts()).not.toBe(emptyOverviewHiddenCharts());
  });
});

describe("withChartHidden", () => {
  it("adds an id once, as a new array", () => {
    const before = ["host_group"];
    const after = withChartHidden(before, "collection_year", true);
    expect(after).toStrictEqual(["host_group", "collection_year"]);
    expect(after).not.toBe(before);
    expect(withChartHidden(after, "collection_year", true)).toBe(after);
  });

  it("removes an id, and keeps the same array when it was not hidden", () => {
    const before = ["host_group", "collection_year"];
    expect(withChartHidden(before, "host_group", false)).toStrictEqual([
      "collection_year",
    ]);
    expect(withChartHidden(before, "isolation_country", false)).toBe(before);
  });

  it("stops adding at the limit", () => {
    const full = Array.from(
      { length: overviewHiddenChartsLimit },
      (_, index) => `field_${String(index)}`,
    );
    expect(withChartHidden(full, "one_more", true)).toBe(full);
  });
});
