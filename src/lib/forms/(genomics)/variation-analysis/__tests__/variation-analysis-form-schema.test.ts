import {
  variationAnalysisFormSchema,
  defaultVariationAnalysisFormValues,
} from "../variation-analysis-form-schema";

const validPayload = {
  ...defaultVariationAnalysisFormValues,
  output_path: "/e2e-test-user@patricbrc.org/home",
  output_file: "var-1",
  reference_genome_id: "511145.12",
  paired_end_libs: [
    {
      _id: "lib-1",
      _type: "paired" as const,
      read1: "/ws/r1.fq",
      read2: "/ws/r2.fq",
      platform: "illumina",
    },
  ],
};

describe("variationAnalysisFormSchema", () => {
  it("safeParse succeeds for a filled-out happy-path payload", () => {
    const result = variationAnalysisFormSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("safeParse fails on the empty default payload", () => {
    const result = variationAnalysisFormSchema.safeParse(
      defaultVariationAnalysisFormValues,
    );
    expect(result.success).toBe(false);
  });

  it("safeParse rejects empty output_path", () => {
    const result = variationAnalysisFormSchema.safeParse({
      ...validPayload,
      output_path: "",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects an invalid mapper enum", () => {
    const result = variationAnalysisFormSchema.safeParse({
      ...validPayload,
      mapper: "not-a-mapper",
    });
    expect(result.success).toBe(false);
  });
});
