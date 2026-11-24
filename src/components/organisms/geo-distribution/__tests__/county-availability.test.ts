import {
  hasCountyData,
  isStateViewAvailable,
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

describe("isStateViewAvailable", () => {
  it("is true when a county has genomes", () => {
    expect(isStateViewAvailable({ countyData: { "Texas|Harris": 9 } })).toBe(
      true,
    );
  });

  it("is false with neither county data nor a county error", () => {
    expect(isStateViewAvailable({ countyData: { "Illinois|Cook": 0 } })).toBe(
      false,
    );
  });

  it("is true when the county query failed, though it left no data", () => {
    expect(
      isStateViewAvailable({ countyData: {}, countyError: "county failed" }),
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
