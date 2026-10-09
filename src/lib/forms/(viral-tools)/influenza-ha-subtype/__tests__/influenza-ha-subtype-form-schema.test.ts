import {
  influenzaHaSubtypeFormSchema,
  defaultInfluenzaHaSubtypeFormValues,
} from "../influenza-ha-subtype-form-schema";

const validPayload = {
  ...defaultInfluenzaHaSubtypeFormValues,
  output_path: "/e2e-test-user@patricbrc.org/home",
  output_file: "ha-1",
  input_fasta_data: ">seq\nMKAILVVLL\n",
  types: ["H1N1pdm"],
};

describe("influenzaHaSubtypeFormSchema", () => {
  it("safeParse succeeds for a filled-out happy-path payload", () => {
    const result = influenzaHaSubtypeFormSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("chooses no numbering scheme by default, as legacy does", () => {
    expect(defaultInfluenzaHaSubtypeFormValues.types).toEqual([]);
  });

  it("safeParse fails on the empty default payload", () => {
    const result = influenzaHaSubtypeFormSchema.safeParse(
      defaultInfluenzaHaSubtypeFormValues,
    );
    expect(result.success).toBe(false);
  });

  it("safeParse rejects empty output_path", () => {
    const result = influenzaHaSubtypeFormSchema.safeParse({
      ...validPayload,
      output_path: "",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects mixed protein and nucleotide records", () => {
    const result = influenzaHaSubtypeFormSchema.safeParse({
      ...validPayload,
      input_fasta_data: ">protein\nMKAILVVLL\n>dna\nACGTACGT",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects an empty types array", () => {
    const result = influenzaHaSubtypeFormSchema.safeParse({
      ...validPayload,
      types: [],
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects an invalid input_source enum", () => {
    const result = influenzaHaSubtypeFormSchema.safeParse({
      ...validPayload,
      input_source: "not-a-source",
    });
    expect(result.success).toBe(false);
  });
});
