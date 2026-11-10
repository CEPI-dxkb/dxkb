vi.mock("./proteome-comparison-form-schema", () => ({}));

import {
  getProteomeComparisonDisplayName,
  createGenomeComparisonItem,
  createFastaComparisonItem,
  createFeatureGroupComparisonItem,
  createGenomeGroupComparisonItem,
  isDuplicateComparisonItem,
  getComparisonItemTypeLabel,
  countTotalComparisonGenomes,
  transformProteomeComparisonParams,
  validateGenomeGroupAddition,
  removeComparisonItemById,
} from "../proteome-comparison-form-utils";

describe("getProteomeComparisonDisplayName", () => {
  it("returns short names unchanged", () => {
    expect(getProteomeComparisonDisplayName("short")).toBe("short");
  });

  it("returns a name exactly at maxLength unchanged", () => {
    const name = "a".repeat(36);
    expect(getProteomeComparisonDisplayName(name)).toBe(name);
  });

  it("truncates names longer than the default maxLength with ellipsis", () => {
    const name = "a".repeat(50);
    const result = getProteomeComparisonDisplayName(name);
    expect(result.length).toBeLessThan(name.length);
    expect(result).toContain("...");
  });

  it("truncates using a custom maxLength", () => {
    const name = "abcdefghijklmnopqrst";
    const result = getProteomeComparisonDisplayName(name, 10);
    expect(result).toContain("...");
    expect(result.length).toBeLessThan(name.length);
  });

  it("preserves start and end of truncated names", () => {
    const name = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF";
    const result = getProteomeComparisonDisplayName(name);
    expect(result.startsWith("ABCDEF")).toBe(true);
    expect(result.endsWith("ABCDEF")).toBe(true);
    expect(result).toContain("...");
  });
});

describe("createGenomeComparisonItem", () => {
  it("returns an item with genome type and correct fields", () => {
    const item = createGenomeComparisonItem("123.456", "E. coli");
    expect(item).toEqual(
      expect.objectContaining({
        id: expect.any(String) as string,
        name: "E. coli",
        genome_id: "123.456",
        type: "genome",
      }),
    );
  });

  it("generates a unique id", () => {
    const a = createGenomeComparisonItem("1", "A");
    const b = createGenomeComparisonItem("2", "B");
    expect(a.id).not.toBe(b.id);
  });
});

describe("createFastaComparisonItem", () => {
  it("returns an item with fasta type and name from last path segment", () => {
    const item = createFastaComparisonItem("/workspace/user/my-file.fasta");
    expect(item).toEqual(
      expect.objectContaining({
        id: expect.any(String) as string,
        name: "my-file.fasta",
        path: "/workspace/user/my-file.fasta",
        type: "fasta",
      }),
    );
  });

  it("uses the full path as name when there is no slash", () => {
    const item = createFastaComparisonItem("single-segment");
    expect(item.name).toBe("single-segment");
  });
});

describe("createFeatureGroupComparisonItem", () => {
  it("returns an item with feature_group type and name from last path segment", () => {
    const item = createFeatureGroupComparisonItem("/workspace/user/my-group");
    expect(item).toEqual(
      expect.objectContaining({
        id: expect.any(String) as string,
        name: "my-group",
        path: "/workspace/user/my-group",
        type: "feature_group",
      }),
    );
  });
});

describe("createGenomeGroupComparisonItem", () => {
  it("returns an item with genome_group type, name, and genome_ids", () => {
    const ids = ["g1", "g2", "g3"];
    const item = createGenomeGroupComparisonItem("/workspace/user/group1", ids);
    expect(item).toEqual(
      expect.objectContaining({
        id: expect.any(String) as string,
        name: "group1",
        path: "/workspace/user/group1",
        type: "genome_group",
        genome_ids: ["g1", "g2", "g3"],
      }),
    );
  });

  it("handles an empty genome_ids array", () => {
    const item = createGenomeGroupComparisonItem("/ws/empty-group", []);
    expect(item.genome_ids).toEqual([]);
  });
});

describe("isDuplicateComparisonItem", () => {
  const existingItems = [
    { id: "1", name: "G1", genome_id: "100.1", type: "genome" as const },
    { id: "2", name: "f.fasta", path: "/ws/f.fasta", type: "fasta" as const },
    { id: "3", name: "fg", path: "/ws/fg", type: "feature_group" as const },
  ];

  it("returns true when genome_id matches", () => {
    expect(isDuplicateComparisonItem(existingItems, { genome_id: "100.1" })).toBe(true);
  });

  it("returns false when genome_id does not match", () => {
    expect(isDuplicateComparisonItem(existingItems, { genome_id: "999.9" })).toBe(false);
  });

  it("returns true when path and type both match", () => {
    expect(
      isDuplicateComparisonItem(existingItems, { path: "/ws/f.fasta", type: "fasta" }),
    ).toBe(true);
  });

  it("returns false when path matches but type differs", () => {
    expect(
      isDuplicateComparisonItem(existingItems, { path: "/ws/f.fasta", type: "feature_group" }),
    ).toBe(false);
  });

  it("returns false when path differs even if type matches", () => {
    expect(
      isDuplicateComparisonItem(existingItems, { path: "/ws/other.fasta", type: "fasta" }),
    ).toBe(false);
  });

  it("returns false for empty items list", () => {
    expect(isDuplicateComparisonItem([], { genome_id: "100.1" })).toBe(false);
  });

  it("returns false when newItem has neither genome_id nor path", () => {
    expect(isDuplicateComparisonItem(existingItems, { name: "something" })).toBe(false);
  });
});

describe("getComparisonItemTypeLabel", () => {
  it("returns 'Genome' for genome type", () => {
    expect(getComparisonItemTypeLabel("genome")).toBe("Genome");
  });

  it("returns 'Protein FASTA' for fasta type", () => {
    expect(getComparisonItemTypeLabel("fasta")).toBe("Protein FASTA");
  });

  it("returns 'Feature Group' for feature_group type", () => {
    expect(getComparisonItemTypeLabel("feature_group")).toBe("Feature Group");
  });

  it("returns 'Genome Group' for genome_group type", () => {
    expect(getComparisonItemTypeLabel("genome_group")).toBe("Genome Group");
  });

  it("returns the raw type string for an unknown type", () => {
    expect(getComparisonItemTypeLabel("unknown" as "genome")).toBe("unknown");
  });
});

describe("countTotalComparisonGenomes", () => {
  it("returns 0 for an empty array", () => {
    expect(countTotalComparisonGenomes([])).toBe(0);
  });

  it("counts non-genome-group items as 1 each", () => {
    const items = [
      { id: "1", name: "G1", genome_id: "100.1", type: "genome" as const },
      { id: "2", name: "f.fasta", path: "/ws/f.fasta", type: "fasta" as const },
      { id: "3", name: "fg", path: "/ws/fg", type: "feature_group" as const },
    ];
    expect(countTotalComparisonGenomes(items)).toBe(3);
  });

  it("counts genome_group items by their genome_ids length", () => {
    const items = [
      {
        id: "1",
        name: "group1",
        path: "/ws/group1",
        type: "genome_group" as const,
        genome_ids: ["a", "b", "c"],
      },
    ];
    expect(countTotalComparisonGenomes(items)).toBe(3);
  });

  it("handles a genome_group with no genome_ids as 1", () => {
    const items = [
      { id: "1", name: "group1", path: "/ws/group1", type: "genome_group" as const },
    ];
    // genome_ids is undefined so the else branch fires, counting 1
    expect(countTotalComparisonGenomes(items)).toBe(1);
  });

  it("mixes genome_groups and regular items correctly", () => {
    const items = [
      { id: "1", name: "G1", genome_id: "100.1", type: "genome" as const },
      {
        id: "2",
        name: "group",
        path: "/ws/group",
        type: "genome_group" as const,
        genome_ids: ["x", "y"],
      },
      { id: "3", name: "f.fasta", path: "/ws/f.fasta", type: "fasta" as const },
    ];
    expect(countTotalComparisonGenomes(items)).toBe(4);
  });
});

describe("transformProteomeComparisonParams", () => {
  const baseData = {
    ref_source_type: "genome" as const,
    ref_genome_id: "ref-genome-1",
    ref_genome_name: "Ref Genome",
    ref_fasta_file: "",
    ref_feature_group: "",
    comparison_items: [] as {
      id: string;
      name: string;
      type: "genome" | "fasta" | "feature_group" | "genome_group";
      genome_id?: string;
      path?: string;
      genome_ids?: string[];
    }[],
    min_seq_cov: 30,
    max_e_val: "1e-5",
    min_ident: 10,
    output_path: "/workspace/user/",
    output_file: "proteome_output",
  };

  it("places the reference genome_id first in genome_ids with index 1", () => {
    const result = transformProteomeComparisonParams(baseData);
    expect(result.genome_ids).toEqual(["ref-genome-1"]);
    expect(result.reference_genome_index).toBe(1);
  });

  it("includes comparison genome ids after the reference", () => {
    const data = {
      ...baseData,
      comparison_items: [
        { id: "c1", name: "C1", genome_id: "comp-1", type: "genome" as const },
        { id: "c2", name: "C2", genome_id: "comp-2", type: "genome" as const },
      ],
    };
    const result = transformProteomeComparisonParams(data);
    expect(result.genome_ids).toEqual(["ref-genome-1", "comp-1", "comp-2"]);
    expect(result.reference_genome_index).toBe(1);
  });

  it("expands genome_group genome_ids into the genome_ids array", () => {
    const data = {
      ...baseData,
      comparison_items: [
        {
          id: "g1",
          name: "Group1",
          path: "/ws/g1",
          type: "genome_group" as const,
          genome_ids: ["gg-1", "gg-2"],
        },
      ],
    };
    const result = transformProteomeComparisonParams(data);
    expect(result.genome_ids).toEqual(["ref-genome-1", "gg-1", "gg-2"]);
  });

  it("adds fasta comparison items to user_genomes", () => {
    const data = {
      ...baseData,
      comparison_items: [
        { id: "f1", name: "file.fasta", path: "/ws/file.fasta", type: "fasta" as const },
      ],
    };
    const result = transformProteomeComparisonParams(data);
    expect(result.user_genomes).toEqual(["/ws/file.fasta"]);
  });

  it("adds feature_group comparison items to user_feature_groups", () => {
    const data = {
      ...baseData,
      comparison_items: [
        { id: "fg1", name: "fg", path: "/ws/fg", type: "feature_group" as const },
      ],
    };
    const result = transformProteomeComparisonParams(data);
    expect(result.user_feature_groups).toEqual(["/ws/fg"]);
  });

  it("does not include user_genomes when none exist", () => {
    const result = transformProteomeComparisonParams(baseData);
    expect(result).not.toHaveProperty("user_genomes");
  });

  it("does not include user_feature_groups when none exist", () => {
    const result = transformProteomeComparisonParams(baseData);
    expect(result).not.toHaveProperty("user_feature_groups");
  });

  it("sets reference_genome_index correctly for fasta reference", () => {
    const data = {
      ...baseData,
      ref_source_type: "fasta" as const,
      ref_genome_id: "",
      ref_fasta_file: "/ws/ref.fasta",
      comparison_items: [
        { id: "c1", name: "C1", genome_id: "comp-1", type: "genome" as const },
      ],
    };
    const result = transformProteomeComparisonParams(data);
    expect(result.genome_ids).toEqual(["comp-1"]);
    expect(result.user_genomes).toEqual(["/ws/ref.fasta"]);
    expect(result.reference_genome_index).toBe(2);
  });

  it("sets reference_genome_index correctly for feature_group reference", () => {
    const data = {
      ...baseData,
      ref_source_type: "feature_group" as const,
      ref_genome_id: "",
      ref_feature_group: "/ws/ref-fg",
      comparison_items: [
        { id: "c1", name: "C1", genome_id: "comp-1", type: "genome" as const },
        { id: "f1", name: "f.fasta", path: "/ws/f.fasta", type: "fasta" as const },
      ],
    };
    const result = transformProteomeComparisonParams(data);
    expect(result.reference_genome_index).toBe(3);
  });

  it("converts min_seq_cov to a decimal", () => {
    const result = transformProteomeComparisonParams(baseData);
    expect(result.min_seq_cov).toBe(0.3);
  });

  it("converts min_ident to a decimal", () => {
    const result = transformProteomeComparisonParams(baseData);
    expect(result.min_ident).toBe(0.1);
  });

  it("passes max_e_val as a trimmed string", () => {
    const data = { ...baseData, max_e_val: "  1e-5  " };
    const result = transformProteomeComparisonParams(data);
    expect(result.max_e_val).toBe("1e-5");
  });

  it("trims output_file", () => {
    const data = { ...baseData, output_file: "  my output  " };
    const result = transformProteomeComparisonParams(data);
    expect(result.output_file).toBe("my output");
  });

  it("includes output_path", () => {
    const result = transformProteomeComparisonParams(baseData);
    expect(result.output_path).toBe("/workspace/user/");
  });
});

describe("validateGenomeGroupAddition", () => {
  it("returns valid when total does not exceed max", () => {
    const items = [
      { id: "1", name: "G1", genome_id: "100.1", type: "genome" as const },
    ];
    const result = validateGenomeGroupAddition(items, ["new1", "new2"], 5);
    expect(result).toEqual({ valid: true });
  });

  it("returns valid when total exactly equals max", () => {
    const items = [
      { id: "1", name: "G1", genome_id: "100.1", type: "genome" as const },
    ];
    const result = validateGenomeGroupAddition(items, ["a", "b", "c", "d"], 5);
    expect(result).toEqual({ valid: true });
  });

  it("returns invalid with message when total exceeds max", () => {
    const items = [
      { id: "1", name: "G1", genome_id: "100.1", type: "genome" as const },
      { id: "2", name: "G2", genome_id: "200.2", type: "genome" as const },
    ];
    const result = validateGenomeGroupAddition(items, ["a", "b", "c"], 4);
    expect(result.valid).toBe(false);
    expect(result.message).toContain("exceed the maximum of 4");
    expect(result.message).toContain("Current: 2");
    expect(result.message).toContain("Group size: 3");
  });

  it("counts genome_group genome_ids in current items", () => {
    const items = [
      {
        id: "1",
        name: "group",
        path: "/ws/group",
        type: "genome_group" as const,
        genome_ids: ["x", "y", "z"],
      },
    ];
    const result = validateGenomeGroupAddition(items, ["a", "b"], 4);
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Current: 3");
  });

  it("returns valid for empty current items", () => {
    const result = validateGenomeGroupAddition([], ["a", "b"], 5);
    expect(result).toEqual({ valid: true });
  });
});

describe("removeComparisonItemById", () => {
  const items = [
    { id: "aaa", name: "G1", genome_id: "100.1", type: "genome" as const },
    { id: "bbb", name: "f.fasta", path: "/ws/f.fasta", type: "fasta" as const },
    { id: "ccc", name: "fg", path: "/ws/fg", type: "feature_group" as const },
  ];

  it("removes the item with the matching id", () => {
    const result = removeComparisonItemById(items, "bbb");
    expect(result).toHaveLength(2);
    expect(result.find((i) => i.id === "bbb")).toBeUndefined();
  });

  it("returns all items when id does not match", () => {
    const result = removeComparisonItemById(items, "zzz");
    expect(result).toHaveLength(3);
  });

  it("returns an empty array when removing from a single-item list", () => {
    const result = removeComparisonItemById([items[0]], "aaa");
    expect(result).toEqual([]);
  });

  it("does not mutate the original array", () => {
    const original = [...items];
    removeComparisonItemById(items, "aaa");
    expect(items).toEqual(original);
  });
});
