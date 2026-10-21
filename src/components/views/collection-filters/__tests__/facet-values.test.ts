import {
  describeFilter,
  displayFacetValue,
  facetValueOptions,
} from "../facet-values";

describe("displayFacetValue", () => {
  it("shows the empty bucket as (empty) and anything else as is", () => {
    expect(displayFacetValue("")).toBe("(empty)");
    expect(displayFacetValue("Complete")).toBe("Complete");
  });
});

describe("facetValueOptions", () => {
  it("lists the counted values in count order", () => {
    expect(
      facetValueOptions(
        [
          { value: "WGS", count: 20 },
          { value: "Complete", count: 10 },
        ],
        ["Complete"],
      ),
    ).toEqual([
      { value: "WGS", count: 20 },
      { value: "Complete", count: 10 },
    ]);
  });

  it("puts a selected value the counts lack first, without a count", () => {
    expect(
      facetValueOptions([{ value: "WGS", count: 20 }], ["Plasmid", "WGS"]),
    ).toEqual([{ value: "Plasmid" }, { value: "WGS", count: 20 }]);
  });

  it("lists only the selection before any counts land", () => {
    expect(facetValueOptions(undefined, ["Plasmid"])).toEqual([
      { value: "Plasmid" },
    ]);
    expect(facetValueOptions(undefined, [])).toEqual([]);
  });

  it("reads a numeric bucket value as text", () => {
    expect(facetValueOptions([{ value: 2020, count: 3 }], ["2020"])).toEqual([
      { value: "2020", count: 3 },
    ]);
  });
});

describe("describeFilter", () => {
  it("joins a filter's values after its label", () => {
    expect(describeFilter("Genome Status", ["Complete", ""])).toBe(
      "Genome Status: Complete, (empty)",
    );
  });
});
