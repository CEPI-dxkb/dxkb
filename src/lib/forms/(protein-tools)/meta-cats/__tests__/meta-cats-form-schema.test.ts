import {
  metaCatsFormSchema,
  defaultMetaCatsFormValues,
} from "../meta-cats-form-schema";

const validPayload = {
  ...defaultMetaCatsFormValues,
  output_path: "/e2e-test-user@patricbrc.org/home",
  output_file: "mc-1",
};

describe("metaCatsFormSchema", () => {
  it("safeParse fails on the empty default payload", () => {
    const result = metaCatsFormSchema.safeParse(defaultMetaCatsFormValues);
    expect(result.success).toBe(false);
  });

  it("safeParse rejects empty output_path", () => {
    const result = metaCatsFormSchema.safeParse({
      ...validPayload,
      output_path: "",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects an invalid input_type enum", () => {
    const result = metaCatsFormSchema.safeParse({
      ...validPayload,
      input_type: "not-a-real-input",
    });
    expect(result.success).toBe(false);
  });
});
