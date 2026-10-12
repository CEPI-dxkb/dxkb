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
  it("safeParse succeeds for a filled-out happy-path payload", () => {
    const result = proteomeComparisonFormSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

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

  it("counts each genome of a genome group against the limit", () => {
    const group = (genomeCount: number) => ({
      id: "group-1",
      name: "Group",
      path: "/e2e-test-user@patricbrc.org/home/Genome Groups/Group",
      type: "genome_group" as const,
      genome_ids: Array.from(
        { length: genomeCount },
        (_, i) => `${String(i)}.1`,
      ),
    });

    // One genome plus a group of eight is the full nine; one more is over,
    // although the list holds only two rows.
    expect(
      proteomeComparisonFormSchema.safeParse({
        ...validPayload,
        comparison_items: [...validPayload.comparison_items, group(8)],
      }).success,
    ).toBe(true);
    const result = proteomeComparisonFormSchema.safeParse({
      ...validPayload,
      comparison_items: [...validPayload.comparison_items, group(9)],
    });
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({
        path: ["comparison_items"],
        message: "Maximum 9 comparison genomes allowed",
      }),
    );
  });
});
