import { buildTaxonomyConfig } from "@/app/(views)/taxonomy/[taxonId]/_config";
import { taxonomicDistributionSentinel } from "@/components/organisms/types";
import {
  amrChartId,
  emptyOverviewHiddenCharts,
  overviewChartViewTypes,
  overviewChartViewTypeScopes,
  overviewHiddenChartsLimit,
  taxonOverviewChartViewType,
  withChartHidden,
} from "../overview-charts";

describe("emptyOverviewHiddenCharts", () => {
  it("hides nothing for any view type, in a fresh object each call", () => {
    expect(emptyOverviewHiddenCharts()).toStrictEqual({
      genome: [],
      bacteria: [],
      viruses: [],
      otherTaxa: [],
    });
    expect(emptyOverviewHiddenCharts()).not.toBe(emptyOverviewHiddenCharts());
  });

  it("lists the view types in the order the cookie value is serialized", () => {
    expect(overviewChartViewTypes).toStrictEqual([
      "genome",
      "bacteria",
      "viruses",
      "otherTaxa",
    ]);
    expect(Object.keys(emptyOverviewHiddenCharts())).toStrictEqual([
      ...overviewChartViewTypes,
    ]);
  });
});

describe("overviewChartViewTypeScopes", () => {
  it("names the group each view type's hidden list covers, once per view type", () => {
    const scopes = overviewChartViewTypes.map(
      (viewType) => overviewChartViewTypeScopes[viewType],
    );

    for (const scope of scopes) {
      expect(scope.length).toBeGreaterThan(0);
    }
    expect(new Set(scopes).size).toBe(overviewChartViewTypes.length);
  });
});

describe("taxonOverviewChartViewType", () => {
  it("gives bacteria and viruses a view type each", () => {
    expect(taxonOverviewChartViewType("bacteria")).toBe("bacteria");
    expect(taxonOverviewChartViewType("viruses")).toBe("viruses");
  });

  it("puts fungi and every other lineage in one shared view type", () => {
    expect(taxonOverviewChartViewType("fungi")).toBe("otherTaxa");
    expect(taxonOverviewChartViewType("all")).toBe("otherTaxa");
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
