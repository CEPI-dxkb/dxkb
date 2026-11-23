import { buildTaxonomyConfig } from "@/app/(views)/taxonomy/[taxonId]/_config";
import { taxonomicDistributionSentinel } from "@/components/organisms/types";
import {
  amrChartId,
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

describe("chart ids", () => {
  // The preference schema accepts ids of 1 to 40 characters (`hiddenChartIds`), and one that
  // does not fit makes its whole list fail to parse once hidden.
  const maxIdLength = 40;
  const overviewFieldIds = buildTaxonomyConfig(234, null).metadataFields;

  it("fit the schema's id cap", () => {
    const ids = [amrChartId, taxonomicDistributionSentinel, ...overviewFieldIds];

    expect(ids.length).toBeGreaterThan(2);
    for (const id of ids) {
      expect(id.length).toBeGreaterThanOrEqual(1);
      expect(id.length).toBeLessThanOrEqual(maxIdLength);
    }
  });

  it("are unique, so one hidden id never hides two charts", () => {
    const ids = [amrChartId, ...overviewFieldIds];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
