vi.mock("../gene-protein-tree-form-schema", () => ({
  maxSequences: 100,
}));

import {
  getDisplayName,
  getSequenceTypeLabel,
  checkDuplicateSequence,
  checkSequenceLimit,
  removeSequenceAtIndex,
  createSequenceItem,
  transformGeneProteinTreeParams,
} from "../gene-protein-tree-form-utils";

describe("getDisplayName", () => {
  it("returns short names unchanged", () => {
    const shortName = "my_file.fasta";
    expect(getDisplayName(shortName)).toBe(shortName);
  });

  it("returns names at the limit unchanged", () => {
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
  it("returns 'Feature Group' for feature_group type", () => {
    expect(getSequenceTypeLabel("feature_group", "DNA")).toBe("Feature Group");
  });

  it("returns aligned DNA FASTA label", () => {
    expect(getSequenceTypeLabel("aligned_dna_fasta", "DNA")).toBe(
      "DNA Aligned FASTA",
    );
  });

  it("returns aligned Protein FASTA label", () => {
    expect(getSequenceTypeLabel("aligned_protein_fasta", "Protein")).toBe(
      "Protein Aligned FASTA",
    );
  });

  it("returns unaligned DNA FASTA label for feature_dna_fasta", () => {
    expect(getSequenceTypeLabel("feature_dna_fasta", "DNA")).toBe(
      "DNA Unaligned FASTA",
    );
  });

  it("returns unaligned Protein FASTA label for feature_protein_fasta", () => {
    expect(getSequenceTypeLabel("feature_protein_fasta", "Protein")).toBe(
      "Protein Unaligned FASTA",
    );
  });
});

describe("checkDuplicateSequence", () => {
  const sequences = [
    { filename: "/path/file1.fasta", type: "aligned_dna_fasta" as const },
    { filename: "/path/file2.fasta", type: "feature_group" as const },
  ];

  it("returns true when the same filename and type already exist", () => {
    expect(
      checkDuplicateSequence(sequences, "/path/file1.fasta", "aligned_dna_fasta"),
    ).toBe(true);
  });

  it("returns false when filename matches but type differs", () => {
    expect(
      checkDuplicateSequence(sequences, "/path/file1.fasta", "feature_group"),
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
      { filename: "b.fasta", type: "feature_group" as const },
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

describe("transformGeneProteinTreeParams", () => {
  const baseFormData = {
    alphabet: "DNA" as const,
    recipe: "RAxML" as const,
    substitution_model: "GTR",
    trim_threshold: "0.5",
    gap_threshold: "0.3",
    sequences: [
      { filename: "/path/seq1.fasta", type: "aligned_dna_fasta" as const },
    ],
    metadata_fields: ["genome_name", "species"],
    output_path: "/output",
    output_file: "  tree_result  ",
  };

  it("includes all expected top-level fields", () => {
    const result = transformGeneProteinTreeParams(baseFormData);

    expect(result).toEqual(
      expect.objectContaining({
        alphabet: "DNA",
        tree_type: "gene",
        recipe: "RAxML",
        substitution_model: "GTR",
        trim_threshold: 0.5,
        gap_threshold: 0.3,
        output_path: "/output",
        output_file: "tree_result",
      }),
    );
  });

  it("maps sequences to filename and type objects", () => {
    const result = transformGeneProteinTreeParams(baseFormData);

    expect(result.sequences).toEqual([
      { filename: "/path/seq1.fasta", type: "aligned_dna_fasta" },
    ]);
  });

  it("sends every metadata field as a genome field and leaves the gene fields to the app", () => {
    const result = transformGeneProteinTreeParams({
      ...baseFormData,
      // Fields outside the frequent list used to go out as feature fields.
      metadata_fields: ["genome_name", "taxon_id", "host_name"],
    });

    expect(result.genome_metadata_fields).toEqual([
      "genome_name",
      "taxon_id",
      "host_name",
    ]);
    expect(result).not.toHaveProperty("feature_metadata_fields");
  });

  it("omits metadata keys when no metadata fields are provided", () => {
    const data = { ...baseFormData, metadata_fields: [] };
    const result = transformGeneProteinTreeParams(data);

    expect(result).not.toHaveProperty("genome_metadata_fields");
    expect(result).not.toHaveProperty("feature_metadata_fields");
  });

  it("omits metadata keys when metadata_fields is undefined", () => {
    const data = { ...baseFormData, metadata_fields: undefined };
    const result = transformGeneProteinTreeParams(data);

    expect(result).not.toHaveProperty("genome_metadata_fields");
    expect(result).not.toHaveProperty("feature_metadata_fields");
  });
});
