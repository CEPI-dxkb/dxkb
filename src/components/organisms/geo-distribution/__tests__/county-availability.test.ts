import {
  hasCountyData,
  stateViewUnavailableReason,
} from "../county-availability";

describe("hasCountyData", () => {
  it("is false when no county has a count", () => {
    expect(hasCountyData({ countyData: {} })).toBe(false);
  });

  it("is false when every county count is zero", () => {
    expect(hasCountyData({ countyData: { "Illinois|Cook": 0 } })).toBe(false);
  });

  it("is true when any county has genomes, in any state", () => {
    expect(
      hasCountyData({ countyData: { "Illinois|Cook": 0, "Texas|Harris": 9 } }),
    ).toBe(true);
  });
});

describe("stateViewUnavailableReason", () => {
  it("names the cause without claiming a permanent gap", () => {
    expect(stateViewUnavailableReason).toBe(
      "County-level data is not available for this taxon.",
    );
  });
});
