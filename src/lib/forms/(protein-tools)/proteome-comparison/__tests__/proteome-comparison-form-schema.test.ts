import {
  proteomeComparisonFormSchema,
  defaultProteomeComparisonFormValues,
} from "../proteome-comparison-form-schema";

const validPayload = {
  ...defaultProteomeComparisonFormValues,
  output_path: "/e2e-test-user@patricbrc.org/home",
  output_file: "pc-1",
  ref_genome_id: "511145.12",
  comparison_items: [
    {
      id: "id-1",
      name: "Mycobacterium tuberculosis",
      genome_id: "83332.111",
      type: "genome" as const,
    },
  ],
};

describe("proteomeComparisonFormSchema", () => {
  it("safeParse fails on the empty default payload", () => {
    const result = proteomeComparisonFormSchema.safeParse(
      defaultProteomeComparisonFormValues,
    );
    expect(result.success).toBe(false);
  });

  it("safeParse rejects empty output_path", () => {
    const result = proteomeComparisonFormSchema.safeParse({
      ...validPayload,
      output_path: "",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects an invalid ref_source_type enum", () => {
    const result = proteomeComparisonFormSchema.safeParse({
      ...validPayload,
      ref_source_type: "not-a-source",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects ref_source_type=fasta with empty ref_fasta_file", () => {
    const result = proteomeComparisonFormSchema.safeParse({
      ...validPayload,
      ref_source_type: "fasta",
      ref_fasta_file: "",
      ref_genome_id: undefined,
    });
    expect(result.success).toBe(false);
  });
});
