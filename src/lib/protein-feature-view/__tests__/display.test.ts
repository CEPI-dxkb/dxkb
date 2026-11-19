import { cleanProteinFeatureValue } from "../display";

describe("cleanProteinFeatureValue", () => {
  it("reads a lone dash as no value, whatever surrounds it", () => {
    expect(cleanProteinFeatureValue("-")).toBe("");
    expect(cleanProteinFeatureValue(" - ")).toBe("");
    expect(cleanProteinFeatureValue("  -  ")).toBe("");
  });

  it("reads a blank as no value", () => {
    expect(cleanProteinFeatureValue("")).toBe("");
    expect(cleanProteinFeatureValue("   ")).toBe("");
  });

  it("keeps a real value, trimmed, including one that contains a dash", () => {
    expect(cleanProteinFeatureValue("Hemagglutinin")).toBe("Hemagglutinin");
    expect(cleanProteinFeatureValue("  IPR001364 ")).toBe("IPR001364");
    expect(cleanProteinFeatureValue("ORF7b_SARS-CoV-2")).toBe(
      "ORF7b_SARS-CoV-2",
    );
    expect(cleanProteinFeatureValue("SARS-CoV-2")).toBe("SARS-CoV-2");
    expect(cleanProteinFeatureValue("7.9E-34")).toBe("7.9E-34");
    expect(cleanProteinFeatureValue("--")).toBe("--");
  });

  it("keeps a number as its string", () => {
    expect(cleanProteinFeatureValue(0.0023)).toBe("0.0023");
    expect(cleanProteinFeatureValue(0)).toBe("0");
  });

  it("reads anything that is not a string or number as no value", () => {
    expect(cleanProteinFeatureValue(undefined)).toBe("");
    expect(cleanProteinFeatureValue(null)).toBe("");
    expect(cleanProteinFeatureValue(["IPR001364"])).toBe("");
    expect(cleanProteinFeatureValue({})).toBe("");
    expect(cleanProteinFeatureValue(true)).toBe("");
  });
});
