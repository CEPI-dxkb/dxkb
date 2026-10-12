import { validateFasta } from "@/lib/fasta-validation";

vi.mock("./msa-snp-analysis-form-schema", () => ({
  minSequences: 2,
  minSequencesWithRef: 1,
}));

vi.mock("@/lib/fasta-validation", () => ({
  validateFasta: vi.fn(() => ({ valid: true, numseq: 3, message: "", status: "valid_protein" })),
}));

import {
  getFastaFileTypeLabel,
  getDisplayName,
  checkDuplicateFastaFile,
  checkFastaFileLimit,
  removeFastaFileAtIndex,
  createFastaFileItem,
  fastaFileFromObject,
  validateSequenceFasta,
  transformMsaSnpAnalysisParams,
} from "../msa-snp-analysis-form-utils";

import type { MsaSnpAnalysisFormData } from "../msa-snp-analysis-form-schema";

// ---------------------------------------------------------------------------
// getFastaFileTypeLabel
// ---------------------------------------------------------------------------
describe("getFastaFileTypeLabel", () => {
  it("returns 'Protein FASTA' for feature_protein_fasta", () => {
    expect(getFastaFileTypeLabel("feature_protein_fasta")).toBe("Protein FASTA");
  });

  it("returns 'DNA FASTA' for feature_dna_fasta", () => {
    expect(getFastaFileTypeLabel("feature_dna_fasta")).toBe("DNA FASTA");
  });

  it("returns 'Aligned Protein FASTA' for aligned_protein_fasta", () => {
    expect(getFastaFileTypeLabel("aligned_protein_fasta")).toBe("Aligned Protein FASTA");
  });

  it("returns 'Aligned DNA FASTA' for aligned_dna_fasta", () => {
    expect(getFastaFileTypeLabel("aligned_dna_fasta")).toBe("Aligned DNA FASTA");
  });

  it("returns the raw type string for an unknown type", () => {
    expect(getFastaFileTypeLabel("unknown_type")).toBe("unknown_type");
  });
});

// ---------------------------------------------------------------------------
// getDisplayName
// ---------------------------------------------------------------------------
describe("getDisplayName", () => {
  it("returns the full name when it is 36 characters or fewer", () => {
    const name = "short-file-name.fasta";
    expect(getDisplayName(name)).toBe(name);
  });

  it("returns the full name when it is exactly 36 characters", () => {
    const name = "a".repeat(36);
    expect(getDisplayName(name)).toBe(name);
  });

  it("truncates names longer than 36 characters with ellipsis", () => {
    const name = "a".repeat(50);
    const result = getDisplayName(name);
    expect(result).toContain("...");
    expect(result.length).toBeLessThan(name.length);
  });

  it("preserves the beginning and end of the name", () => {
    const name = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ";
    const result = getDisplayName(name);
    // First 16 chars (36/2 - 2 = 16)
    expect(result.startsWith("abcdefghijklmnop")).toBe(true);
    // Last 20 chars (length - (36/2) + 2 = length - 16)
    expect(result.endsWith("ABCDEFGHIJ")).toBe(true);
    expect(result).toContain("...");
  });
});

// ---------------------------------------------------------------------------
// checkDuplicateFastaFile
// ---------------------------------------------------------------------------
describe("checkDuplicateFastaFile", () => {
  const existingFiles = [
    { file: "/workspace/seq1.fasta", type: "feature_protein_fasta" as const },
    { file: "/workspace/seq2.fasta", type: "feature_dna_fasta" as const },
  ];

  it("returns true when the same file and type already exist", () => {
    expect(
      checkDuplicateFastaFile(existingFiles, "/workspace/seq1.fasta", "feature_protein_fasta"),
    ).toBe(true);
  });

  it("returns false when the file exists but with a different type", () => {
    expect(
      checkDuplicateFastaFile(existingFiles, "/workspace/seq1.fasta", "feature_dna_fasta"),
    ).toBe(false);
  });

  it("returns false when the file path does not exist", () => {
    expect(
      checkDuplicateFastaFile(existingFiles, "/workspace/new.fasta", "feature_protein_fasta"),
    ).toBe(false);
  });

  it("returns false for an empty file list", () => {
    expect(checkDuplicateFastaFile([], "/workspace/seq1.fasta", "feature_protein_fasta")).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// checkFastaFileLimit
// ---------------------------------------------------------------------------
describe("checkFastaFileLimit", () => {
  it("always returns false (no limit currently enforced)", () => {
    expect(checkFastaFileLimit([])).toBe(false);
  });

  it("returns false even with many files", () => {
    const files = Array.from({ length: 100 }, (_, i) => ({
      file: `/workspace/seq${String(i)}.fasta`,
      type: "feature_protein_fasta" as const,
    }));
    expect(checkFastaFileLimit(files)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// removeFastaFileAtIndex
// ---------------------------------------------------------------------------
describe("removeFastaFileAtIndex", () => {
  const files = [
    { file: "/workspace/a.fasta", type: "feature_protein_fasta" as const },
    { file: "/workspace/b.fasta", type: "feature_dna_fasta" as const },
    { file: "/workspace/c.fasta", type: "aligned_protein_fasta" as const },
  ];

  it("removes the file at the given index", () => {
    const result = removeFastaFileAtIndex(files, 1);
    expect(result).toHaveLength(2);
    expect(result[0].file).toBe("/workspace/a.fasta");
    expect(result[1].file).toBe("/workspace/c.fasta");
  });

  it("removes the first file when index is 0", () => {
    const result = removeFastaFileAtIndex(files, 0);
    expect(result).toHaveLength(2);
    expect(result[0].file).toBe("/workspace/b.fasta");
  });

  it("removes the last file when index is the last position", () => {
    const result = removeFastaFileAtIndex(files, 2);
    expect(result).toHaveLength(2);
    expect(result[1].file).toBe("/workspace/b.fasta");
  });

  it("does not mutate the original array", () => {
    const original = [...files];
    removeFastaFileAtIndex(files, 1);
    expect(files).toEqual(original);
  });

  it("returns all files when index is out of bounds", () => {
    const result = removeFastaFileAtIndex(files, 99);
    expect(result).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// createFastaFileItem
// ---------------------------------------------------------------------------
describe("createFastaFileItem", () => {
  it("creates a file item with the given file and type", () => {
    const item = createFastaFileItem("/workspace/seq.fasta", "feature_protein_fasta");
    expect(item).toEqual({ file: "/workspace/seq.fasta", type: "feature_protein_fasta" });
  });

  it("creates a file item with a DNA type", () => {
    const item = createFastaFileItem("/workspace/dna.fasta", "feature_dna_fasta");
    expect(item).toEqual({ file: "/workspace/dna.fasta", type: "feature_dna_fasta" });
  });
});

describe("fastaFileFromObject", () => {
  it("types a file by its workspace type, not its path", () => {
    expect(
      fastaFileFromObject(
        { path: "/ws/aa/genes.fasta", type: "feature_dna_fasta" },
        "feature",
      ),
    ).toEqual({ file: "/ws/aa/genes.fasta", type: "feature_dna_fasta" });
    expect(
      fastaFileFromObject(
        { path: "/ws/genes.fna", type: "feature_protein_fasta" },
        "feature",
      ).type,
    ).toBe("feature_protein_fasta");
    expect(
      fastaFileFromObject(
        { path: "/ws/aln.afa", type: "aligned_protein_fasta" },
        "aligned",
      ).type,
    ).toBe("aligned_protein_fasta");
    expect(
      fastaFileFromObject(
        { path: "/ws/protein.afa", type: "aligned_dna_fasta" },
        "aligned",
      ).type,
    ).toBe("aligned_dna_fasta");
  });
});

// ---------------------------------------------------------------------------
// validateSequenceFasta
// ---------------------------------------------------------------------------
describe("validateSequenceFasta", () => {
  beforeEach(() => {
    vi.mocked(validateFasta).mockReturnValue({
      valid: true,
      numseq: 3,
      message: "",
      status: "valid_protein",
      trimFasta: "",
    });
  });

  it("calls validateFasta with the text and 'aa' type", () => {
    validateSequenceFasta(">seq1\nACGT");
    expect(validateFasta).toHaveBeenCalledWith(">seq1\nACGT", "aa");
  });

  it("returns meetsMinSequenceRequirement true when numseq >= minSequences (2)", () => {
    const result = validateSequenceFasta(">seq1\nACGT");
    expect(result.meetsMinSequenceRequirement).toBe(true);
    expect(result.valid).toBe(true);
  });

  it("returns meetsMinSequenceRequirement false when numseq < minSequences", () => {
    vi.mocked(validateFasta).mockReturnValue({
      valid: true,
      numseq: 1,
      message: "",
      status: "valid_protein",
      trimFasta: "",
    });
    const result = validateSequenceFasta(">seq1\nACGT");
    expect(result.meetsMinSequenceRequirement).toBe(false);
  });

  it("uses minSequencesWithRef (1) when hasReference is true", () => {
    vi.mocked(validateFasta).mockReturnValue({
      valid: true,
      numseq: 1,
      message: "",
      status: "valid_protein",
      trimFasta: "",
    });
    const result = validateSequenceFasta(">seq1\nACGT", true);
    expect(result.meetsMinSequenceRequirement).toBe(true);
  });

  it("returns meetsMinSequenceRequirement false when validation is invalid", () => {
    vi.mocked(validateFasta).mockReturnValue({
      valid: false,
      numseq: 5,
      message: "invalid",
      status: "too_short",
      trimFasta: "",
    });
    const result = validateSequenceFasta(">bad");
    expect(result.meetsMinSequenceRequirement).toBe(false);
  });

  it("spreads the full validation result into the return value", () => {
    vi.mocked(validateFasta).mockReturnValue({
      valid: true,
      numseq: 4,
      message: "",
      status: "valid_dna",
      trimFasta: ">trimmed",
    });
    const result = validateSequenceFasta(">seq\nACGT");
    expect(result.status).toBe("valid_dna");
    expect(result.numseq).toBe(4);
    expect(result.trimFasta).toBe(">trimmed");
  });
});

// ---------------------------------------------------------------------------
// transformMsaSnpAnalysisParams
// ---------------------------------------------------------------------------
describe("transformMsaSnpAnalysisParams", () => {
  const baseData: MsaSnpAnalysisFormData = {
    input_status: "unaligned",
    input_type: "input_fasta",
    fasta_files: [{ file: "/workspace/seq.fasta", type: "feature_protein_fasta" }],
    ref_type: "none",
    ref_string: "",
    aligner: "Mafft",
    strategy: "auto",
    output_path: "/workspace/user/",
    output_file: "my-output",
  };

  beforeEach(() => {
    vi.mocked(validateFasta).mockReturnValue({
      valid: true,
      numseq: 3,
      message: "",
      status: "valid_protein",
      trimFasta: "",
    });
  });

  it("includes input_status, aligner, output_path, and trimmed output_file", () => {
    const result = transformMsaSnpAnalysisParams(baseData);
    expect(result.input_status).toBe("unaligned");
    expect(result.aligner).toBe("Mafft");
    expect(result.output_path).toBe("/workspace/user/");
    expect(result.output_file).toBe("my-output");
  });

  it("trims whitespace from output_file", () => {
    const data = { ...baseData, output_file: "  my-output  " };
    const result = transformMsaSnpAnalysisParams(data);
    expect(result.output_file).toBe("my-output");
  });

  // -- Unaligned: input_fasta --
  it("sets input_type to input_fasta and includes fasta_files", () => {
    const result = transformMsaSnpAnalysisParams(baseData);
    expect(result.input_type).toBe("input_fasta");
    expect(result.fasta_files).toEqual([
      { file: "/workspace/seq.fasta", type: "feature_protein_fasta" },
    ]);
  });

  // -- Unaligned: input_sequence --
  it("sets input_type to input_sequence and includes trimmed fasta_keyboard_input", () => {
    const data: MsaSnpAnalysisFormData = {
      ...baseData,
      input_type: "input_sequence",
      fasta_files: [],
      fasta_keyboard_input: "  >seq1\nACGT  ",
    };
    const result = transformMsaSnpAnalysisParams(data);
    expect(result.input_type).toBe("input_sequence");
    expect(result.fasta_keyboard_input).toBe(">seq1\nACGT");
  });

  // -- Unaligned: input_feature_group --
  it("maps input_feature_group to input_group and wraps feature_groups in array", () => {
    const data: MsaSnpAnalysisFormData = {
      ...baseData,
      input_type: "input_feature_group",
      feature_groups: "/my/feature/group",
      alphabet: "protein",
      fasta_files: [],
    };
    const result = transformMsaSnpAnalysisParams(data);
    expect(result.input_type).toBe("input_group");
    expect(result.feature_groups).toEqual(["/my/feature/group"]);
    expect(result.alphabet).toBe("protein");
  });

  it("does not include feature_groups when it is empty", () => {
    const data: MsaSnpAnalysisFormData = {
      ...baseData,
      input_type: "input_feature_group",
      feature_groups: "",
      alphabet: "dna",
      fasta_files: [],
    };
    const result = transformMsaSnpAnalysisParams(data);
    expect(result).not.toHaveProperty("feature_groups");
  });

  // -- Unaligned: input_genome_group --
  it("maps input_genome_group to input_genomegroup and includes select_genomegroup", () => {
    const data: MsaSnpAnalysisFormData = {
      ...baseData,
      input_type: "input_genome_group",
      select_genomegroup: ["group1", "group2"],
      fasta_files: [],
    };
    const result = transformMsaSnpAnalysisParams(data);
    expect(result.input_type).toBe("input_genomegroup");
    expect(result.select_genomegroup).toEqual(["group1", "group2"]);
  });

  // -- Aligned --
  it("includes fasta_files when input_status is aligned", () => {
    const data: MsaSnpAnalysisFormData = {
      ...baseData,
      input_status: "aligned",
      input_type: undefined,
      fasta_files: [{ file: "/workspace/aligned.fasta", type: "aligned_protein_fasta" }],
    };
    const result = transformMsaSnpAnalysisParams(data);
    expect(result.fasta_files).toEqual([
      { file: "/workspace/aligned.fasta", type: "aligned_protein_fasta" },
    ]);
    expect(result).not.toHaveProperty("input_type");
  });

  it("names no aligner or strategy for an aligned file, which is not realigned", () => {
    const result = transformMsaSnpAnalysisParams({
      ...baseData,
      input_status: "aligned",
      input_type: undefined,
      aligner: "Mafft",
      strategy: "auto",
      fasta_files: [{ file: "/workspace/aligned.fasta", type: "aligned_dna_fasta" }],
    });
    expect(result).not.toHaveProperty("aligner");
    expect(result).not.toHaveProperty("strategy");
    expect(result).not.toHaveProperty("strategy_settings");
  });

  // -- Reference --
  it("includes ref_type and ref_string when ref_string is provided", () => {
    const data: MsaSnpAnalysisFormData = {
      ...baseData,
      ref_type: "string",
      ref_string: "  >ref\nMKTL  ",
    };
    const result = transformMsaSnpAnalysisParams(data);
    expect(result.ref_type).toBe("string");
    expect(result.ref_string).toBe(">ref\nMKTL");
  });

  it("does not include ref_string when it is empty", () => {
    const result = transformMsaSnpAnalysisParams(baseData);
    expect(result.ref_type).toBe("none");
    expect(result).not.toHaveProperty("ref_string");
  });

  // -- Strategy --
  it("includes strategy and strategy_settings for Mafft aligner", () => {
    const result = transformMsaSnpAnalysisParams(baseData);
    expect(result.strategy).toBe("auto");
    expect(result.strategy_settings).toBe("auto");
  });

  it("does not include strategy for Muscle aligner", () => {
    const data: MsaSnpAnalysisFormData = {
      ...baseData,
      aligner: "Muscle",
      strategy: undefined,
    };
    const result = transformMsaSnpAnalysisParams(data);
    expect(result).not.toHaveProperty("strategy");
    expect(result).not.toHaveProperty("strategy_settings");
  });

  // -- Alphabet detection --
  it("detects protein alphabet from fasta_files type", () => {
    const result = transformMsaSnpAnalysisParams(baseData);
    expect(result.alphabet).toBe("protein");
  });

  it("detects dna alphabet from fasta_files type", () => {
    const data: MsaSnpAnalysisFormData = {
      ...baseData,
      fasta_files: [{ file: "/workspace/seq.fasta", type: "feature_dna_fasta" }],
    };
    const result = transformMsaSnpAnalysisParams(data);
    expect(result.alphabet).toBe("dna");
  });

  it("detects alphabet from keyboard input via validateFasta", () => {
    vi.mocked(validateFasta).mockReturnValue({
      valid: true,
      numseq: 2,
      message: "",
      status: "valid_protein",
      trimFasta: "",
    });
    const data: MsaSnpAnalysisFormData = {
      ...baseData,
      input_type: "input_sequence",
      fasta_files: [],
      fasta_keyboard_input: ">seq1\nMKTLIIFS",
    };
    const result = transformMsaSnpAnalysisParams(data);
    expect(result.alphabet).toBe("protein");
  });

  it("detects dna alphabet from keyboard input when status is not valid_protein", () => {
    vi.mocked(validateFasta).mockReturnValue({
      valid: true,
      numseq: 2,
      message: "",
      status: "valid_dna",
      trimFasta: "",
    });
    const data: MsaSnpAnalysisFormData = {
      ...baseData,
      input_type: "input_sequence",
      fasta_files: [],
      fasta_keyboard_input: ">seq1\nACGTACGT",
    };
    const result = transformMsaSnpAnalysisParams(data);
    expect(result.alphabet).toBe("dna");
  });

  it("defaults alphabet to dna when no fasta_files or keyboard input", () => {
    const data: MsaSnpAnalysisFormData = {
      ...baseData,
      input_type: "input_genome_group",
      select_genomegroup: ["group1"],
      fasta_files: [],
      fasta_keyboard_input: "",
    };
    const result = transformMsaSnpAnalysisParams(data);
    expect(result.alphabet).toBe("dna");
  });

  it("does not override alphabet already set by feature group input", () => {
    const data: MsaSnpAnalysisFormData = {
      ...baseData,
      input_type: "input_feature_group",
      feature_groups: "/my/group",
      alphabet: "protein",
      fasta_files: [],
    };
    const result = transformMsaSnpAnalysisParams(data);
    expect(result.alphabet).toBe("protein");
  });
});
