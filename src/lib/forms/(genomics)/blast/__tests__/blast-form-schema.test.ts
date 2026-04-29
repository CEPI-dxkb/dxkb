import {
  completeFormSchema,
  defaultBlastFormValues,
} from "../blast-form-schema";

describe("blast completeFormSchema", () => {
  const valid = {
    ...defaultBlastFormValues,
    output_path: "/e2e-test-user@patricbrc.org/home",
    output_file: "blast-1",
    input_fasta_data: ">seq\nACGT\n",
  };

  it("safeParse succeeds for a filled-out happy-path payload", () => {
    const result = completeFormSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("safeParse fails when output_file is empty", () => {
    const result = completeFormSchema.safeParse({ ...valid, output_file: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path.join("."))).toContain(
        "output_file",
      );
    }
  });

  it("safeParse fails on an unknown blast_program enum value", () => {
    const result = completeFormSchema.safeParse({
      ...valid,
      blast_program: "fake-program",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse fails when input_source=fasta_data has empty input_fasta_data", () => {
    const result = completeFormSchema.safeParse({
      ...valid,
      input_fasta_data: "",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse adds a custom issue for selGenome with no genomes selected", () => {
    const result = completeFormSchema.safeParse({
      ...valid,
      db_precomputed_database: "selGenome",
      db_genome_list: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path.join("."))).toContain(
        "db_genome_list",
      );
    }
  });
});
