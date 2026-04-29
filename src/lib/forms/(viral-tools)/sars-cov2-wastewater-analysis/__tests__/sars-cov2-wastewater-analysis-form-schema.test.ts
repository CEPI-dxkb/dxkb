import {
  sarsCov2WastewaterAnalysisFormSchema,
  defaultSarsCov2WastewaterAnalysisFormValues,
} from "../sars-cov2-wastewater-analysis-form-schema";

const validPayload = {
  ...defaultSarsCov2WastewaterAnalysisFormValues,
  output_path: "/e2e-test-user@patricbrc.org/home",
  output_file: "ww-1",
};

describe("sarsCov2WastewaterAnalysisFormSchema", () => {
  it("safeParse fails on the empty default payload", () => {
    const result = sarsCov2WastewaterAnalysisFormSchema.safeParse(
      defaultSarsCov2WastewaterAnalysisFormValues,
    );
    expect(result.success).toBe(false);
  });

  it("safeParse rejects empty output_path", () => {
    const result = sarsCov2WastewaterAnalysisFormSchema.safeParse({
      ...validPayload,
      output_path: "",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects an invalid recipe enum", () => {
    const result = sarsCov2WastewaterAnalysisFormSchema.safeParse({
      ...validPayload,
      recipe: "not-a-recipe",
    });
    expect(result.success).toBe(false);
  });
});
