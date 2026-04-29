import {
  primerDesignFormSchema,
  defaultPrimerDesignFormValues,
} from "../primer-design-form-schema";

const validPayload = {
  ...defaultPrimerDesignFormValues,
  output_path: "/e2e-test-user@patricbrc.org/home",
  output_file: "primer-1",
  sequence_input: ">seq\nACGTACGTACGTACGT\n",
};

describe("primerDesignFormSchema", () => {
  it("safeParse succeeds for a filled-out happy-path payload", () => {
    const result = primerDesignFormSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("safeParse fails on the empty default payload", () => {
    const result = primerDesignFormSchema.safeParse(
      defaultPrimerDesignFormValues,
    );
    expect(result.success).toBe(false);
  });

  it("safeParse rejects empty output_path", () => {
    const result = primerDesignFormSchema.safeParse({
      ...validPayload,
      output_path: "",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects an invalid input_type enum", () => {
    const result = primerDesignFormSchema.safeParse({
      ...validPayload,
      input_type: "not-a-real-input",
    });
    expect(result.success).toBe(false);
  });
});
