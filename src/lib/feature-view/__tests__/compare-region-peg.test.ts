import {
  compareRegionAvailability,
  compareRegionNoBrcIdReason,
  compareRegionPendingReason,
  compareRegionTwinRql,
  currentCompareRegionAvailability,
  ownCompareRegionPeg,
  patricIdGenomeId,
  settledCompareRegionAvailability,
} from "../compare-region-peg";
import { featureViewRecordSchema } from "../schema";

function record(fields: Record<string, unknown>) {
  return featureViewRecordSchema.parse({ feature_id: "f1", ...fields });
}

describe("patricIdGenomeId", () => {
  it.each([
    ["fig|511145.12.peg.1", "511145.12"],
    ["fig|2697049.6703420.CDS.11", "2697049.6703420"],
    ["fig|2697049.6699399.mat_peptide.10", "2697049.6699399"],
    ["rast|0.CDS.1", null],
    ["fig1543206.11.peg.4", null],
  ])("reads the genome out of %s", (id, genomeId) => {
    expect(patricIdGenomeId(id)).toBe(genomeId);
  });
});

describe("ownCompareRegionPeg", () => {
  const cds = { feature_type: "CDS", patric_id: "fig|511145.12.peg.1" };

  it("takes the BRC ID of a CDS", () => {
    expect(ownCompareRegionPeg(record(cds))).toBe("fig|511145.12.peg.1");
    expect(
      ownCompareRegionPeg(record({ ...cds, genome_id: "511145.12" })),
    ).toBe("fig|511145.12.peg.1");
  });

  it("takes a viral CDS id", () => {
    expect(
      ownCompareRegionPeg(
        record({
          feature_type: "CDS",
          patric_id: "fig|2697049.6703420.CDS.11",
          genome_id: "2697049.6703420",
        }),
      ),
    ).toBe("fig|2697049.6703420.CDS.11");
  });

  it("takes the BRC ID of a feature that is not a CDS", () => {
    expect(
      ownCompareRegionPeg(
        record({ feature_type: "tRNA", patric_id: "fig|511145.12.rna.7" }),
      ),
    ).toBe("fig|511145.12.rna.7");
    expect(
      ownCompareRegionPeg(
        record({
          feature_type: "mat_peptide",
          patric_id: "fig|2697049.6699399.mat_peptide.10",
        }),
      ),
    ).toBe("fig|2697049.6699399.mat_peptide.10");
  });

  it("refuses a missing BRC ID and a non-fig id", () => {
    expect(ownCompareRegionPeg(record({ feature_type: "CDS" }))).toBeNull();
    expect(
      ownCompareRegionPeg(record({ feature_type: "CDS", patric_id: "rast|0.CDS.1" })),
    ).toBeNull();
  });

  it("refuses a BRC ID that names another genome", () => {
    expect(
      ownCompareRegionPeg(
        record({
          feature_type: "CDS",
          patric_id: "fig|6666666.253573.peg.1140",
          genome_id: "587851.11",
        }),
      ),
    ).toBeNull();
  });

  it("refuses a BRC ID whose genome part is not numeric when the record names a genome", () => {
    const nonNumeric = { feature_type: "CDS", patric_id: "fig|Dm_GEO12.peg.245" };
    expect(
      ownCompareRegionPeg(record({ ...nonNumeric, genome_id: "61435.38" })),
    ).toBeNull();
    // Without a genome to compare against, a fig| id is still trusted.
    expect(ownCompareRegionPeg(record(nonNumeric))).toBe("fig|Dm_GEO12.peg.245");
  });
});

describe("compareRegionTwinRql", () => {
  const refseq = {
    annotation: "RefSeq",
    feature_type: "CDS",
    sequence_id: "NC_000913",
    end: 2799,
    strand: "+",
  };

  it("asks for the PATRIC feature of the same type at the same end and strand", () => {
    expect(compareRegionTwinRql(record(refseq))).toBe(
      "and(eq(annotation,PATRIC),eq(feature_type,CDS),eq(sequence_id,NC_000913),eq(end,2799),eq(strand,%22%2B%22))",
    );
    expect(compareRegionTwinRql(record({ ...refseq, strand: "-" }))).toContain(
      "eq(strand,%22-%22)",
    );
    expect(
      compareRegionTwinRql(record({ ...refseq, feature_type: "tRNA" })),
    ).toContain("eq(feature_type,tRNA)");
  });

  it("keeps the twin in the feature's own genome when it names one", () => {
    expect(
      compareRegionTwinRql(record({ ...refseq, genome_id: "511145.12" })),
    ).toBe(
      "and(eq(annotation,PATRIC),eq(genome_id,511145.12),eq(feature_type,CDS),eq(sequence_id,NC_000913),eq(end,2799),eq(strand,%22%2B%22))",
    );
  });

  it("looks a RefSeq gene's CDS up, because PATRIC has no gene type", () => {
    expect(
      compareRegionTwinRql(record({ ...refseq, feature_type: "gene" })),
    ).toContain("eq(feature_type,CDS)");
  });

  it("asks for nothing a PATRIC feature, or one without a location or type, could answer", () => {
    expect(compareRegionTwinRql(record({ ...refseq, annotation: "PATRIC" }))).toBeNull();
    expect(compareRegionTwinRql(record({ ...refseq, sequence_id: undefined }))).toBeNull();
    expect(compareRegionTwinRql(record({ ...refseq, end: undefined }))).toBeNull();
    expect(compareRegionTwinRql(record({ ...refseq, strand: "." }))).toBeNull();
    expect(compareRegionTwinRql(record({ ...refseq, feature_type: undefined }))).toBeNull();
  });
});

describe("compareRegionAvailability", () => {
  it("prefers the feature's own BRC ID over a twin", () => {
    const own = record({ feature_type: "CDS", patric_id: "fig|1.1.peg.1" });
    expect(compareRegionAvailability(own, "fig|1.1.peg.9")).toEqual({
      peg: "fig|1.1.peg.1",
    });
  });

  it("uses the twin's BRC ID when the feature has none", () => {
    const refseq = record({ annotation: "RefSeq", feature_type: "CDS" });
    expect(compareRegionAvailability(refseq, "fig|1.1.peg.9")).toEqual({
      peg: "fig|1.1.peg.9",
    });
  });

  it("says why a feature cannot be compared", () => {
    for (const fields of [
      { annotation: "RefSeq", feature_type: "CDS" },
      { annotation: "RefSeq", feature_type: "tRNA" },
      { annotation: "PATRIC", feature_type: "source" },
    ]) {
      expect(compareRegionAvailability(record(fields))).toEqual({
        peg: null,
        reason: compareRegionNoBrcIdReason,
      });
    }
  });
});

describe("settledCompareRegionAvailability", () => {
  const locatedRefseq = {
    annotation: "RefSeq",
    feature_type: "CDS",
    genome_id: "1.1",
    sequence_id: "NC_1",
    end: 100,
    strand: "+",
  };

  it("answers from a feature's own BRC ID without a lookup", () => {
    expect(
      settledCompareRegionAvailability(
        record({ feature_type: "CDS", patric_id: "fig|1.1.peg.1" }),
      ),
    ).toEqual({ peg: "fig|1.1.peg.1" });
  });

  it("closes the tab when nothing locates a counterpart", () => {
    expect(
      settledCompareRegionAvailability(
        record({ ...locatedRefseq, end: undefined }),
      ),
    ).toEqual({ peg: null, reason: compareRegionNoBrcIdReason });
    expect(
      settledCompareRegionAvailability(
        record({ annotation: "PATRIC", feature_type: "source" }),
      ),
    ).toEqual({ peg: null, reason: compareRegionNoBrcIdReason });
  });

  it("leaves a feature that needs its counterpart to the lookup", () => {
    expect(settledCompareRegionAvailability(record(locatedRefseq))).toBeNull();
    // Another genome's BRC ID is refused, so the counterpart decides.
    expect(
      settledCompareRegionAvailability(
        record({ ...locatedRefseq, patric_id: "fig|9.9.peg.1" }),
      ),
    ).toBeNull();
  });
});

describe("currentCompareRegionAvailability", () => {
  it("keeps a settled answer", () => {
    expect(currentCompareRegionAvailability({ peg: "fig|1.1.peg.1" })).toEqual(
      { peg: "fig|1.1.peg.1" },
    );
  });

  it("keeps the tab off with the pending reason while the lookup runs", () => {
    expect(
      currentCompareRegionAvailability(new Promise(() => undefined)),
    ).toEqual({ peg: null, reason: compareRegionPendingReason });
  });
});
