import { idsFromRows } from "../collection-selection";

describe("idsFromRows", () => {
  it("collects scalar Genome IDs from Genome rows", () => {
    expect(
      idsFromRows(
        [{ genome_id: "83332.12" }, { genome_id: 11320 }],
        "genome_id",
      ),
    ).toEqual(["83332.12", "11320"]);
  });

  it("flattens and de-duplicates multi-valued fields", () => {
    expect(
      idsFromRows(
        [
          { genome_ids: ["11320.1", "11320.2"] },
          { genome_ids: ["11320.2", " 11320.3 "] },
        ],
        "genome_ids",
      ),
    ).toEqual(["11320.1", "11320.2", "11320.3"]);
  });

  it("pools both Interaction interactor columns in row order", () => {
    expect(
      idsFromRows(
        [
          { feature_id_a: "feature-a1", feature_id_b: "feature-b1" },
          { feature_id_a: "feature-a2", feature_id_b: "feature-a1" },
        ],
        ["feature_id_a", "feature_id_b"],
      ),
    ).toEqual(["feature-a1", "feature-b1", "feature-a2"]);
  });

  it("skips rows missing the field and non-scalar entries", () => {
    expect(
      idsFromRows(
        [{}, { genome_id: null }, { genome_id: "" }, { genome_id: {} }],
        "genome_id",
      ),
    ).toEqual([]);
  });
});
