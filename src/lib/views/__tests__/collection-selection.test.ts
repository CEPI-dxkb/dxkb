import { maxRqlInValues } from "@/lib/data-api/rql";
import {
  idsFromRows,
  selectionGroupMaxIds,
  selectionGroupMaxRows,
  selectionListMaxIds,
  selectionServicesMaxIds,
  selectionServicesMaxRows,
} from "../collection-selection";

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

describe("selection ID ceilings", () => {
  it("takes the list and services ceilings from the Data API in(...) limit", () => {
    expect(selectionListMaxIds).toBe(maxRqlInValues);
    expect(selectionServicesMaxIds).toBe(maxRqlInValues);
    // GROUP writes one workspace object instead, so it keeps the row ceiling's room.
    expect(selectionGroupMaxIds).toBe(selectionGroupMaxRows);
  });

  it("rejects a Strain selection that flattens past the services ID ceiling", () => {
    // 40 segmented Strain rows are well inside the 100-row fetch bound, but each row
    // carries 20 genomes, so the selection resolves to 800 genome IDs.
    const rows = Array.from({ length: 40 }, (_, row) => ({
      genome_ids: Array.from(
        { length: 20 },
        (_, segment) => `1132${String(row)}.${String(segment)}`,
      ),
    }));

    expect(rows.length).toBeLessThanOrEqual(selectionServicesMaxRows);
    expect(idsFromRows(rows, "genome_ids")).toHaveLength(800);
    expect(idsFromRows(rows, "genome_ids").length).toBeGreaterThan(
      selectionServicesMaxIds,
    );
  });

  it("accepts a selection whose flattened IDs de-duplicate back under the ceiling", () => {
    // Every row lists the same 20 genomes (one strain seen through 40 rows), so the
    // ceiling has to be measured after de-duplication, not on the raw fan-out.
    const genomeIds = Array.from(
      { length: 20 },
      (_, i) => `11320.${String(i)}`,
    );
    const rows = Array.from({ length: 40 }, () => ({ genome_ids: genomeIds }));

    expect(idsFromRows(rows, "genome_ids")).toHaveLength(20);
    expect(idsFromRows(rows, "genome_ids").length).toBeLessThanOrEqual(
      selectionServicesMaxIds,
    );
  });

  it("counts both Interaction interactors when measuring the list ceiling", () => {
    // 300 rows, two distinct interactors each, is 600 feature IDs for a 500-value in().
    const rows = Array.from({ length: 300 }, (_, i) => ({
      feature_id_a: `feature-a${String(i)}`,
      feature_id_b: `feature-b${String(i)}`,
    }));
    const ids = idsFromRows(rows, ["feature_id_a", "feature_id_b"]);

    expect(ids).toHaveLength(600);
    expect(ids.length).toBeGreaterThan(selectionListMaxIds);
  });
});
