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

  it("safeParse rejects gene_set_type=fasta with empty gene_set_fasta", () => {
    const result = metagenomicReadMappingFormSchema.safeParse({
      ...validPayload,
      gene_set_type: "fasta",
      gene_set_fasta: "",
    });
    expect(result.success).toBe(false);
  });
});
