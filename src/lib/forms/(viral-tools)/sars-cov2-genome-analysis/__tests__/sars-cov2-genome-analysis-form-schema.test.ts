import {
  sarsCov2GenomeAnalysisFormSchema,
  defaultSarsCov2GenomeAnalysisFormValues,
} from "../sars-cov2-genome-analysis-form-schema";

const validPayload = {
  ...defaultSarsCov2GenomeAnalysisFormValues,
  output_path: "/e2e-test-user@patricbrc.org/home",
  output_file: "sars-1",
  my_label: "isolate-1",
  paired_end_libs: [
    {
      _id: "lib-1",
      _type: "paired" as const,
      read1: "/ws/r1.fq",
      read2: "/ws/r2.fq",
      platform: "illumina" as const,
    },
  ],
};

describe("sarsCov2GenomeAnalysisFormSchema", () => {
  it("safeParse fails on the empty default payload", () => {
    const result = sarsCov2GenomeAnalysisFormSchema.safeParse(
      defaultSarsCov2GenomeAnalysisFormValues,
    );
    expect(result.success).toBe(false);
  });

  it("safeParse rejects empty output_path", () => {
    const result = sarsCov2GenomeAnalysisFormSchema.safeParse({
      ...validPayload,
      output_path: "",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects an invalid recipe enum", () => {
    const result = sarsCov2GenomeAnalysisFormSchema.safeParse({
      ...validPayload,
      recipe: "not-a-recipe",
    });
    expect(result.success).toBe(false);
  });
});
