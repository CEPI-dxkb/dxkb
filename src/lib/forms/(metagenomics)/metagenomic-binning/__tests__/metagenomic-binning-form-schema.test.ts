import {
  metagenomicBinningFormSchema,
  defaultMetagenomicBinningFormValues,
} from "../metagenomic-binning-form-schema";

const validPayload = {
  ...defaultMetagenomicBinningFormValues,
  output_path: "/e2e-test-user@patricbrc.org/home",
  output_file: "binning-1",
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

describe("metagenomicBinningFormSchema", () => {
  it("safeParse succeeds for a filled-out happy-path payload", () => {
    const result = metagenomicBinningFormSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("safeParse rejects start_with=reads with no libraries even when output fields are filled", () => {
    // Strip every library source so only the "missing libraries" refinement fails.
    const result = metagenomicBinningFormSchema.safeParse({
      ...validPayload,
      paired_end_libs: [],
      single_end_libs: [],
      srr_ids: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const libIssue = result.error.issues.find((issue) =>
        issue.path.includes("paired_end_libs"),
      );
      expect(libIssue?.message).toMatch(/at least one library/i);
    }
  });

  it("safeParse rejects empty output_path", () => {
    const result = metagenomicBinningFormSchema.safeParse({
      ...validPayload,
      output_path: "",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects start_with=contigs with no contigs file", () => {
    const result = metagenomicBinningFormSchema.safeParse({
      ...validPayload,
      start_with: "contigs",
      contigs: "",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects an invalid assembler enum", () => {
    const result = metagenomicBinningFormSchema.safeParse({
      ...validPayload,
      assembler: "not-a-real-assembler",
    });
    expect(result.success).toBe(false);
  });
});
