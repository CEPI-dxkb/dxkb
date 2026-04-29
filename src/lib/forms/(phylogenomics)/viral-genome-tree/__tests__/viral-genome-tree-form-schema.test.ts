import {
  viralGenomeTreeFormSchema,
  defaultViralGenomeTreeFormValues,
} from "../viral-genome-tree-form-schema";

const validPayload = {
  ...defaultViralGenomeTreeFormValues,
  output_path: "/e2e-test-user@patricbrc.org/home",
  output_file: "vgt-1",
};

describe("viralGenomeTreeFormSchema", () => {
  it("safeParse fails on the empty default payload (no genomes, empty paths)", () => {
    const result = viralGenomeTreeFormSchema.safeParse(
      defaultViralGenomeTreeFormValues,
    );
    expect(result.success).toBe(false);
  });

  it("safeParse rejects empty output_path", () => {
    const result = viralGenomeTreeFormSchema.safeParse({
      ...validPayload,
      output_path: "",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects empty output_file", () => {
    const result = viralGenomeTreeFormSchema.safeParse({
      ...validPayload,
      output_file: "",
    });
    expect(result.success).toBe(false);
  });
});
