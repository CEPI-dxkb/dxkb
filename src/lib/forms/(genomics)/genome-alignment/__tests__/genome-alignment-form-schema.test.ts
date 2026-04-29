import {
  genomeAlignmentFormSchema,
  defaultGenomeAlignmentFormValues,
} from "../genome-alignment-form-schema";

const validPayload = {
  ...defaultGenomeAlignmentFormValues,
  output_path: "/e2e-test-user@patricbrc.org/home",
  output_file: "ga-1",
  genome_ids: ["83332.111", "83333.111"],
};

describe("genomeAlignmentFormSchema", () => {
  it("safeParse succeeds for a filled-out happy-path payload", () => {
    const result = genomeAlignmentFormSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("safeParse fails on the empty default payload (no genomes, empty paths)", () => {
    const result = genomeAlignmentFormSchema.safeParse(
      defaultGenomeAlignmentFormValues,
    );
    expect(result.success).toBe(false);
  });

  it("safeParse rejects empty output_path", () => {
    const result = genomeAlignmentFormSchema.safeParse({
      ...validPayload,
      output_path: "",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects an invalid recipe enum", () => {
    const result = genomeAlignmentFormSchema.safeParse({
      ...validPayload,
      recipe: "not-a-real-recipe",
    });
    expect(result.success).toBe(false);
  });
});
