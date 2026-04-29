import {
  influenzaHaSubtypeFormSchema,
  defaultInfluenzaHaSubtypeFormValues,
} from "../influenza-ha-subtype-form-schema";

const validPayload = {
  ...defaultInfluenzaHaSubtypeFormValues,
  output_path: "/e2e-test-user@patricbrc.org/home",
  output_file: "ha-1",
  input_fasta_data: ">seq\nMKAILVVLL\n",
};

describe("influenzaHaSubtypeFormSchema", () => {
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
