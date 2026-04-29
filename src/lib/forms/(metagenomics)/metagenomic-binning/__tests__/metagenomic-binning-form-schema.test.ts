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

  it("safeParse fails on default empty payload (missing libraries when start_with=reads)", () => {
    const result = metagenomicBinningFormSchema.safeParse(
      defaultMetagenomicBinningFormValues,
    );
    expect(result.success).toBe(false);
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
