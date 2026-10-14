import { featureDisplayName, featureFastaTypes } from "../display";

const featureId = "PATRIC.644340.17.JAEUGC010000001.CDS.12314.12580.rev";

describe("featureDisplayName", () => {
  it("prefers the BRC ID", () => {
    expect(
      featureDisplayName({
        feature_id: featureId,
        patric_id: "fig|644340.17.peg.16",
        refseq_locus_tag: "BME_RS00080",
      }),
    ).toBe("fig|644340.17.peg.16");
  });

  it("falls back through the RefSeq locus tag and protein ID", () => {
    expect(
      featureDisplayName({
        feature_id: featureId,
        refseq_locus_tag: "BME_RS00080",
        protein_id: "WP_002964185.1",
      }),
    ).toBe("BME_RS00080");
    expect(
      featureDisplayName({ feature_id: featureId, protein_id: "WP_1.1" }),
    ).toBe("WP_1.1");
  });

  it("uses the internal key only when nothing public is present", () => {
    expect(featureDisplayName({ feature_id: featureId })).toBe(featureId);
  });

  it("skips blank identifiers", () => {
    expect(
      featureDisplayName({
        feature_id: featureId,
        patric_id: "",
        refseq_locus_tag: "BME_RS00080",
      }),
    ).toBe("BME_RS00080");
    expect(
      featureDisplayName({
        feature_id: featureId,
        patric_id: " ",
        refseq_locus_tag: "",
        protein_id: "",
      }),
    ).toBe(featureId);
  });
});

describe("featureFastaTypes", () => {
  it("offers DNA and protein for a coding feature", () => {
    expect(
      featureFastaTypes({ feature_id: featureId, na_length: 267, aa_length: 88 }),
    ).toEqual(["dna", "protein"]);
  });

  it("offers DNA only for an untranslated feature", () => {
    expect(
      featureFastaTypes({ feature_id: featureId, na_length: "1490" }),
    ).toEqual(["dna"]);
  });

  it("accepts a sequence hash when the length is missing", () => {
    expect(
      featureFastaTypes({
        feature_id: featureId,
        na_sequence_md5: "fada28201fd9184dcb70d15b9d3d346e",
        aa_sequence_md5: "e5a5527dc616466361772e464d2494e3",
      }),
    ).toEqual(["dna", "protein"]);
  });

  it("offers nothing for a record with no sequence", () => {
    expect(
      featureFastaTypes({ feature_id: featureId, na_length: 0, aa_length: "" }),
    ).toEqual([]);
  });
});
