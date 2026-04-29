import {
  msaSnpAnalysisFormSchema,
  defaultMsaSnpAnalysisFormValues,
} from "../msa-snp-analysis-form-schema";

const validPayload = {
  ...defaultMsaSnpAnalysisFormValues,
  output_path: "/e2e-test-user@patricbrc.org/home",
  output_file: "msa-1",
  feature_groups: "/ws/group",
};

describe("msaSnpAnalysisFormSchema", () => {
  it("safeParse fails on the empty default payload", () => {
    const result = msaSnpAnalysisFormSchema.safeParse(
      defaultMsaSnpAnalysisFormValues,
    );
    expect(result.success).toBe(false);
  });

  it("safeParse rejects empty output_path", () => {
    const result = msaSnpAnalysisFormSchema.safeParse({
      ...validPayload,
      output_path: "",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects an invalid aligner enum", () => {
    const result = msaSnpAnalysisFormSchema.safeParse({
      ...validPayload,
      aligner: "not-an-aligner",
    });
    expect(result.success).toBe(false);
  });
});
