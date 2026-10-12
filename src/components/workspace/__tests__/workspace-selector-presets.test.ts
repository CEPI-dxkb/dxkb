import { resolveSelectorPreset } from "../workspace-selector-presets";

describe("workspace selector presets", () => {
  it("featureFastaOrContigs matches legacy Subspecies Classification's FASTA types", () => {
    // Legacy also lists genome_protein_fasta and genome_dna_fasta, which no
    // workspace upload type produces (BV-BRC WorkspaceManager.js has neither).
    expect(resolveSelectorPreset("featureFastaOrContigs")).toEqual([
      "feature_protein_fasta",
      "feature_dna_fasta",
      "contigs",
    ]);
  });
});
