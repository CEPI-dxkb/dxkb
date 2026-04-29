vi.mock("../fastq-utilities-form-schema", () => ({
  pipelineActionOptions: [
    { value: "trim", label: "Trim" },
    { value: "align", label: "Align" },
    { value: "fastqc", label: "FastQC" },
  ],
}));

import {
  transformFastqUtilitiesParams,
  isAlignSelected,
  createPipelineActionItem,
  removePipelineActionItem,
  actionItemsToRecipe,
  actionColors,
} from "../fastq-utilities-form-utils";

const baseFormData = {
  output_path: "/output",
  output_file: "my_result",
  recipe: ["trim"] as ("trim" | "align" | "fastqc")[],
  paired_end_libs: [],
  single_end_libs: [],
  srr_ids: [],
  reference_genome_id: "",
};

describe("transformFastqUtilitiesParams", () => {
  it("includes basic fields in the result", () => {
    const result = transformFastqUtilitiesParams(baseFormData);

    expect(result).toEqual(
      expect.objectContaining({
        output_path: "/output",
        output_file: "my_result",
        recipe: ["trim"],
      }),
    );
  });

  it("trims output_file whitespace", () => {
    const data = { ...baseFormData, output_file: "  result  " };
    const result = transformFastqUtilitiesParams(data);

    expect(result.output_file).toBe("result");
  });

  it("includes reference_genome_id when recipe contains align", () => {
    const data = {
      ...baseFormData,
      recipe: ["align"] as ("trim" | "align" | "fastqc")[],
      reference_genome_id: " genome123 ",
    };
    const result = transformFastqUtilitiesParams(data);

    expect(result.reference_genome_id).toBe("genome123");
  });

  it("excludes reference_genome_id when recipe does not contain align", () => {
    const data = {
      ...baseFormData,
      recipe: ["trim"] as ("trim" | "align" | "fastqc")[],
      reference_genome_id: "genome123",
    };
    const result = transformFastqUtilitiesParams(data);

    expect(result).not.toHaveProperty("reference_genome_id");
  });

  it("maps paired_end_libs with read1 and read2", () => {
    const data = {
      ...baseFormData,
      paired_end_libs: [
        {
          _id: "1",
          _type: "paired" as const,
          read1: "/r1.fq",
          read2: "/r2.fq",
        },
      ],
    };
    const result = transformFastqUtilitiesParams(data);

    expect(result.paired_end_libs).toEqual([
      { read1: "/r1.fq", read2: "/r2.fq" },
    ]);
  });

  it("maps single_end_libs with read and platform", () => {
    const data = {
      ...baseFormData,
      single_end_libs: [
        {
          _id: "1",
          _type: "single" as const,
          read: "/reads.fq",
          platform: "illumina" as const,
        },
      ],
    };
    const result = transformFastqUtilitiesParams(data);

    expect(result.single_end_libs).toEqual([
      { read: "/reads.fq", platform: "illumina" },
    ]);
  });

  it("maps srr_ids to srr_libs with srr_accession", () => {
    const data = {
      ...baseFormData,
      srr_ids: ["SRR000001", "SRR000002"],
    };
    const result = transformFastqUtilitiesParams(data);

    expect(result.srr_libs).toEqual([
      { srr_accession: "SRR000001" },
      { srr_accession: "SRR000002" },
    ]);
  });

  it("excludes library keys when arrays are empty", () => {
    const result = transformFastqUtilitiesParams(baseFormData);

    expect(result).not.toHaveProperty("paired_end_libs");
    expect(result).not.toHaveProperty("single_end_libs");
    expect(result).not.toHaveProperty("srr_libs");
  });
});

describe("isAlignSelected", () => {
  it("returns true when align is in the recipe", () => {
    expect(isAlignSelected(["trim", "align"])).toBe(true);
  });

  it("returns false when align is not in the recipe", () => {
    expect(isAlignSelected(["trim", "fastqc"])).toBe(false);
  });

  it("returns false for an empty recipe", () => {
    expect(isAlignSelected([])).toBe(false);
  });
});

describe("createPipelineActionItem", () => {
  it("returns an item with action, label, and color", () => {
    const item = createPipelineActionItem("trim");

    expect(item).toEqual(
      expect.objectContaining({
        action: "trim",
        label: "Trim",
        color: actionColors[0],
      }),
    );
    expect(item.id).toContain("trim_");
  });

  it("uses default index 0 when no index is provided", () => {
    const item = createPipelineActionItem("align");

    expect(item.color).toBe(actionColors[0]);
  });

  it("uses the specified index for color assignment", () => {
    const item = createPipelineActionItem("align", 2);

    expect(item.color).toBe(actionColors[2]);
  });

  it("wraps color index when it exceeds the color array length", () => {
    const item = createPipelineActionItem("trim", actionColors.length + 1);

    expect(item.color).toBe(actionColors[1]);
  });
});

describe("removePipelineActionItem", () => {
  it("removes the item with the given id", () => {
    const items = [
      { id: "a", action: "trim" as const, label: "Trim", color: actionColors[0] },
      { id: "b", action: "align" as const, label: "Align", color: actionColors[1] },
      { id: "c", action: "fastqc" as const, label: "FastQC", color: actionColors[2] },
    ];

    const result = removePipelineActionItem(items, "b");

    expect(result).toHaveLength(2);
    expect(result.map((i) => i.action)).toEqual(["trim", "fastqc"]);
  });

  it("renormalizes colors after removal", () => {
    const items = [
      { id: "a", action: "trim" as const, label: "Trim", color: actionColors[0] },
      { id: "b", action: "align" as const, label: "Align", color: actionColors[1] },
      { id: "c", action: "fastqc" as const, label: "FastQC", color: actionColors[2] },
    ];

    const result = removePipelineActionItem(items, "a");

    expect(result[0].color).toBe(actionColors[0]);
    expect(result[1].color).toBe(actionColors[1]);
  });

  it("returns an empty array when the only item is removed", () => {
    const items = [
      { id: "a", action: "trim" as const, label: "Trim", color: actionColors[0] },
    ];

    const result = removePipelineActionItem(items, "a");

    expect(result).toEqual([]);
  });
});

describe("actionItemsToRecipe", () => {
  it("extracts action values from items", () => {
    const items = [
      { id: "a", action: "trim" as const, label: "Trim", color: actionColors[0] },
      { id: "b", action: "align" as const, label: "Align", color: actionColors[1] },
    ];

    expect(actionItemsToRecipe(items)).toEqual(["trim", "align"]);
  });

  it("returns an empty array for empty input", () => {
    expect(actionItemsToRecipe([])).toEqual([]);
  });
});
