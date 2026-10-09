vi.mock("../viral-genome-tree-form-schema", () => ({
  maxSequences: 100,
}));

import {
  getDisplayName,
  getSequenceTypeLabel,
  checkDuplicateSequence,
  checkSequenceLimit,
  removeSequenceAtIndex,
  createSequenceItem,
  transformViralGenomeTreeParams,
} from "../viral-genome-tree-form-utils";

describe("getDisplayName", () => {
  it("returns short names unchanged", () => {
    const shortName = "my_file.fasta";
    expect(getDisplayName(shortName)).toBe(shortName);
  });

  it("returns names at the 36-char limit unchanged", () => {
    const exactName = "a".repeat(36);
    expect(getDisplayName(exactName)).toBe(exactName);
  });

  it("truncates long names with ellipsis in the middle", () => {
    const longName = "a".repeat(50);
    const result = getDisplayName(longName);

    expect(result).toContain("...");
    expect(result.length).toBeLessThan(longName.length);
  });
});

describe("getSequenceTypeLabel", () => {
  it("returns 'Genome Group' for genome_group type", () => {
    expect(getSequenceTypeLabel("genome_group")).toBe("Genome Group");
  });

  it("returns 'Aligned DNA FASTA' for aligned_dna_fasta type", () => {
    expect(getSequenceTypeLabel("aligned_dna_fasta")).toBe("Aligned DNA FASTA");
  });

  it("returns 'Unaligned DNA FASTA' for unaligned types", () => {
    expect(getSequenceTypeLabel("feature_dna_fasta")).toBe(
      "Unaligned DNA FASTA",
    );
  });
});

describe("checkDuplicateSequence", () => {
  const sequences = [
    { filename: "/path/file1.fasta", type: "aligned_dna_fasta" as const },
    { filename: "/path/file2.fasta", type: "genome_group" as const },
  ];

  it("returns true when the same filename and type already exist", () => {
    expect(
      checkDuplicateSequence(sequences, "/path/file1.fasta", "aligned_dna_fasta"),
    ).toBe(true);
  });

  it("returns false when filename matches but type differs", () => {
    expect(
      checkDuplicateSequence(sequences, "/path/file1.fasta", "genome_group"),
    ).toBe(false);
  });

  it("returns false when filename does not exist", () => {
    expect(
      checkDuplicateSequence(sequences, "/path/new.fasta", "aligned_dna_fasta"),
    ).toBe(false);
  });

  it("returns false for an empty list", () => {
    expect(
      checkDuplicateSequence([], "/path/file.fasta", "aligned_dna_fasta"),
    ).toBe(false);
  });
});

describe("checkSequenceLimit", () => {
  it("returns true when sequences are at the limit", () => {
    const sequences = Array.from({ length: 100 }, (_, i) => ({
      filename: `file${String(i)}.fasta`,
      type: "aligned_dna_fasta" as const,
    }));

    expect(checkSequenceLimit(sequences)).toBe(true);
  });

  it("returns false when below the limit", () => {
    const sequences = [
      { filename: "file.fasta", type: "aligned_dna_fasta" as const },
    ];

    expect(checkSequenceLimit(sequences)).toBe(false);
  });

  it("returns true when above the limit", () => {
    const sequences = Array.from({ length: 101 }, (_, i) => ({
      filename: `file${String(i)}.fasta`,
      type: "aligned_dna_fasta" as const,
    }));

    expect(checkSequenceLimit(sequences)).toBe(true);
  });
});

describe("removeSequenceAtIndex", () => {
  it("removes the item at the specified index", () => {
    const sequences = [
      { filename: "a.fasta", type: "aligned_dna_fasta" as const },
      { filename: "b.fasta", type: "genome_group" as const },
      { filename: "c.fasta", type: "feature_dna_fasta" as const },
    ];

    const result = removeSequenceAtIndex(sequences, 1);

    expect(result).toHaveLength(2);
    expect(result.map((s) => s.filename)).toEqual(["a.fasta", "c.fasta"]);
  });

  it("returns an empty array when removing the only item", () => {
    const sequences = [
      { filename: "a.fasta", type: "aligned_dna_fasta" as const },
    ];

    expect(removeSequenceAtIndex(sequences, 0)).toEqual([]);
  });
});

describe("createSequenceItem", () => {
  it("returns an object with filename and type", () => {
    const item = createSequenceItem("/path/seq.fasta", "aligned_dna_fasta");

    expect(item).toEqual({
      filename: "/path/seq.fasta",
      type: "aligned_dna_fasta",
    });
  });
});

describe("transformViralGenomeTreeParams", () => {
  const baseFormData = {
    recipe: "RAxML" as const,
    substitution_model: "GTR",
    trim_threshold: "0.5",
    gap_threshold: "0.3",
    sequences: [
      { filename: "/path/seq1.fasta", type: "aligned_dna_fasta" as const },
    ],
    metadata_fields: ["genome_name"],
    output_path: "/output",
    output_file: "  viral_result  ",
  };

  it("includes all expected top-level fields", () => {
    const result = transformViralGenomeTreeParams(baseFormData);

    expect(result).toEqual(
      expect.objectContaining({
        alphabet: "DNA",
        tree_type: "viral_genome",
        recipe: "RAxML",
        substitution_model: "GTR",
        trim_threshold: 0.5,
        gap_threshold: 0.3,
        output_path: "/output",
        output_file: "viral_result",
      }),
    );
  });

  it("always sets alphabet to DNA", () => {
    const result = transformViralGenomeTreeParams(baseFormData);

    expect(result.alphabet).toBe("DNA");
  });

  it("maps sequences to filename and type objects", () => {
    const result = transformViralGenomeTreeParams(baseFormData);

    expect(result.sequences).toEqual([
      { filename: "/path/seq1.fasta", type: "aligned_dna_fasta" },
    ]);
  });

  it("includes genome_metadata_fields when metadata_fields are provided", () => {
    const result = transformViralGenomeTreeParams(baseFormData);

    expect(result.genome_metadata_fields).toEqual(["genome_name"]);
  });

  it("omits genome_metadata_fields when metadata_fields is empty", () => {
    const data = { ...baseFormData, metadata_fields: [] };
    const result = transformViralGenomeTreeParams(data);

    expect(result).not.toHaveProperty("genome_metadata_fields");
  });

  it("omits genome_metadata_fields when metadata_fields is undefined", () => {
    const data = { ...baseFormData, metadata_fields: undefined };
    const result = transformViralGenomeTreeParams(data);

    expect(result).not.toHaveProperty("genome_metadata_fields");
  });
});
