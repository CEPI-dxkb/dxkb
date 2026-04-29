import {
  metagenomicReadMappingFormSchema,
  defaultMetagenomicReadMappingFormValues,
} from "../metagenomic-read-mapping-form-schema";

const validPayload = {
  ...defaultMetagenomicReadMappingFormValues,
  output_path: "/e2e-test-user@patricbrc.org/home",
  output_file: "mrm-1",
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

describe("metagenomicReadMappingFormSchema", () => {
  it("safeParse succeeds for a filled-out happy-path payload", () => {
    const result = metagenomicReadMappingFormSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("safeParse fails on the empty default payload", () => {
    const result = metagenomicReadMappingFormSchema.safeParse(
      defaultMetagenomicReadMappingFormValues,
    );
    expect(result.success).toBe(false);
  });

  it("safeParse rejects empty output_path", () => {
    const result = metagenomicReadMappingFormSchema.safeParse({
      ...validPayload,
      output_path: "",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects gene_set_type=fasta_file with empty gene_set_fasta", () => {
    const result = metagenomicReadMappingFormSchema.safeParse({
      ...validPayload,
      gene_set_type: "fasta_file",
      gene_set_fasta: "",
    });
    expect(result.success).toBe(false);
    // Pin the issue to the FASTA-specific superRefine branch so the test fails if the
    // schema starts accepting empty FASTA paths or moves the check elsewhere — without
    // this we'd silently keep passing on any unrelated rejection (e.g. enum miss).
    if (!result.success) {
      const fastaIssue = result.error.issues.find((issue) =>
        issue.path.includes("gene_set_fasta"),
      );
      expect(fastaIssue?.message).toMatch(/fasta/i);
    }
  });
});
