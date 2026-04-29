import {
  genomeAssemblyFormSchema,
  defaultGenomeAssemblyFormValues,
} from "../genome-assembly-form-schema";

const validPayload = {
  ...defaultGenomeAssemblyFormValues,
  output_path: "/e2e-test-user@patricbrc.org/home",
  output_file: "assembly-1",
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

describe("genomeAssemblyFormSchema", () => {
  it("safeParse succeeds for a filled-out happy-path payload", () => {
    const result = genomeAssemblyFormSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("safeParse fails on the empty default payload (no libraries, empty paths)", () => {
    const result = genomeAssemblyFormSchema.safeParse(
      defaultGenomeAssemblyFormValues,
    );
    expect(result.success).toBe(false);
  });

  it("safeParse rejects empty output_file", () => {
    const result = genomeAssemblyFormSchema.safeParse({
      ...validPayload,
      output_file: "",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects empty recipe (required string)", () => {
    const result = genomeAssemblyFormSchema.safeParse({
      ...validPayload,
      recipe: "",
    });
    expect(result.success).toBe(false);
  });
});
