import {
  viralAssemblyFormSchema,
  defaultViralAssemblyFormValues,
} from "../viral-assembly-form-schema";

const validPayload = {
  ...defaultViralAssemblyFormValues,
  output_path: "/e2e-test-user@patricbrc.org/home",
  output_file: "viral-1",
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

describe("viralAssemblyFormSchema", () => {
  it("safeParse fails on the empty default payload", () => {
    const result = viralAssemblyFormSchema.safeParse(
      defaultViralAssemblyFormValues,
    );
    expect(result.success).toBe(false);
  });

  it("safeParse rejects empty output_path", () => {
    const result = viralAssemblyFormSchema.safeParse({
      ...validPayload,
      output_path: "",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects an invalid input_type enum", () => {
    const result = viralAssemblyFormSchema.safeParse({
      ...validPayload,
      input_type: "not-an-input",
    });
    expect(result.success).toBe(false);
  });
});
