import {
  fastqUtilitiesFormSchema,
  defaultFastqUtilitiesFormValues,
} from "../fastq-utilities-form-schema";

const validPayload = {
  ...defaultFastqUtilitiesFormValues,
  output_path: "/e2e-test-user@patricbrc.org/home",
  output_file: "fastq-1",
  recipe: ["trim" as const],
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

describe("fastqUtilitiesFormSchema", () => {
  it("safeParse succeeds for a filled-out happy-path payload", () => {
    const result = fastqUtilitiesFormSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("safeParse fails on the empty default payload (no recipe, empty paths)", () => {
    const result = fastqUtilitiesFormSchema.safeParse(
      defaultFastqUtilitiesFormValues,
    );
    expect(result.success).toBe(false);
  });

  it("safeParse rejects an empty recipe", () => {
    const result = fastqUtilitiesFormSchema.safeParse({
      ...validPayload,
      recipe: [],
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects an unknown pipelineAction in the recipe", () => {
    const result = fastqUtilitiesFormSchema.safeParse({
      ...validPayload,
      recipe: ["not-a-real-action"],
    });
    expect(result.success).toBe(false);
  });
});
