import { featureStandIn } from "../feature-card";
import { focusRow, mirroredRow, testGene } from "@/test-helpers/compare-region";

describe("featureStandIn", () => {
  it("writes the comparison's fields as genome_feature fields", () => {
    expect(featureStandIn(focusRow.features[1], focusRow)).toEqual({
      patric_id: "fig|1.1.peg.2",
      genome_id: "1.1",
      genome_name: "Escherichia coli str. K-12 substr. MG1655",
      start: 900,
      end: 1200,
      strand: "+",
      product: "Focus protein",
      pgfam_id: "PGF_00000001",
    });
  });

  it("orders a minus-strand span low to high, as the record does", () => {
    expect(featureStandIn(mirroredRow.features[0], mirroredRow)).toEqual(
      expect.objectContaining({ start: 4800, end: 5100, strand: "-" }),
    );
  });

  it("files a PLfam id under the local family", () => {
    const gene = testGene("fig|1.1.peg.5", 10, 90, {
      familyId: "PLF_561_00000001",
    });
    const standIn = featureStandIn(gene, focusRow);
    expect(standIn.plfam_id).toBe("PLF_561_00000001");
    expect(standIn).not.toHaveProperty("pgfam_id");
  });

  it("leaves out what the comparison does not know", () => {
    const blast = focusRow.features[2];
    const unnamed = { ...blast, product: "", familyId: null };
    const standIn = featureStandIn(unnamed, focusRow);
    expect(standIn.strand).toBeUndefined();
    expect(standIn.product).toBeUndefined();
    expect(standIn).not.toHaveProperty("pgfam_id");
    expect(standIn).not.toHaveProperty("plfam_id");
  });
});
