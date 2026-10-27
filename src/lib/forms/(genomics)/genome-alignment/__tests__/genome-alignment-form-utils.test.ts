vi.mock("../genome-alignment-form-schema", () => ({}));

import {
  transformGenomeAlignmentParams,
  createGenomeAlignmentFormValues,
  idOnlyGenome,
} from "../genome-alignment-form-utils";

const baseFormData = {
  genome_ids: ["genome1", "genome2"],
  recipe: "progressiveMauve" as const,
  output_path: "/output",
  output_file: "alignment_result",
  manual_seed_weight: false,
  seed_weight: 15,
  weight: undefined,
  genome_group_path: undefined,
};

describe("transformGenomeAlignmentParams", () => {
  it("includes basic fields in the result", () => {
    const result = transformGenomeAlignmentParams(baseFormData);

    expect(result).toEqual(
      expect.objectContaining({
        genome_ids: ["genome1", "genome2"],
        recipe: "progressiveMauve",
        output_path: "/output",
        output_file: "alignment_result",
      }),
    );
  });

  it("sets seedWeight to null when manual_seed_weight is false", () => {
    const data = { ...baseFormData, manual_seed_weight: false, seed_weight: 10 };
    const result = transformGenomeAlignmentParams(data);

    expect(result.seedWeight).toBeNull();
  });

  it("sets seedWeight from seed_weight when manual_seed_weight is true", () => {
    const data = { ...baseFormData, manual_seed_weight: true, seed_weight: 12 };
    const result = transformGenomeAlignmentParams(data);

    expect(result.seedWeight).toBe(12);
  });

  it("includes weight when it is defined", () => {
    const data = { ...baseFormData, weight: 5 };
    const result = transformGenomeAlignmentParams(data);

    expect(result.weight).toBe(5);
  });

  it("excludes weight when it is undefined", () => {
    const data = { ...baseFormData, weight: undefined };
    const result = transformGenomeAlignmentParams(data);

    expect(result).not.toHaveProperty("weight");
  });
});

describe("createGenomeAlignmentFormValues", () => {
  it("merges overrides onto current values", () => {
    const overrides = {
      output_file: "new_output",
      genome_ids: ["genome3"],
    };

    const result = createGenomeAlignmentFormValues(baseFormData, overrides);

    expect(result).toEqual({
      ...baseFormData,
      output_file: "new_output",
      genome_ids: ["genome3"],
    });
  });
});

describe("idOnlyGenome", () => {
  it("names a genome by its ID when its record did not load", () => {
    expect(idOnlyGenome("83332.12")).toEqual({
      genome_id: "83332.12",
      genome_name: "83332.12",
    });
  });
});
