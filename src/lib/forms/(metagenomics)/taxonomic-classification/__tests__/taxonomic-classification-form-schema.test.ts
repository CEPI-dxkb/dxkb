import {
  taxonomicClassificationFormSchema,
  defaultTaxonomicClassificationFormValues,
} from "../taxonomic-classification-form-schema";

const validPayload = {
  ...defaultTaxonomicClassificationFormValues,
  output_path: "/e2e-test-user@patricbrc.org/home",
  output_file: "tax-1",
  paired_end_libs: [
    {
      _id: "lib-1",
      _type: "paired" as const,
      read1: "/ws/r1.fq",
      read2: "/ws/r2.fq",
      platform: "illumina",
      sample_id: "sample-1",
    },
  ],
  paired_sample_id: "sample-1",
};

describe("taxonomicClassificationFormSchema", () => {
  it("safeParse fails on the empty default payload", () => {
    const result = taxonomicClassificationFormSchema.safeParse(
      defaultTaxonomicClassificationFormValues,
    );
    expect(result.success).toBe(false);
  });

  it("safeParse rejects empty output_path", () => {
    const result = taxonomicClassificationFormSchema.safeParse({
      ...validPayload,
      output_path: "",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects an invalid analysis_type enum", () => {
    const result = taxonomicClassificationFormSchema.safeParse({
      ...validPayload,
      analysis_type: "not-a-real-type",
    });
    expect(result.success).toBe(false);
  });
});
