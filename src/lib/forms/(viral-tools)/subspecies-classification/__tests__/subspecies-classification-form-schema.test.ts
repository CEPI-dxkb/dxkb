import {
  subspeciesClassificationFormSchema,
  defaultSubspeciesClassificationFormValues,
} from "../subspecies-classification-form-schema";

const validPayload = {
  ...defaultSubspeciesClassificationFormValues,
  output_path: "/e2e-test-user@patricbrc.org/home",
  output_file: "ssc-1",
};

describe("subspeciesClassificationFormSchema", () => {
  it("safeParse fails on the empty default payload", () => {
    const result = subspeciesClassificationFormSchema.safeParse(
      defaultSubspeciesClassificationFormValues,
    );
    expect(result.success).toBe(false);
  });

  it("safeParse rejects empty output_path", () => {
    const result = subspeciesClassificationFormSchema.safeParse({
      ...validPayload,
      output_path: "",
    });
    expect(result.success).toBe(false);
  });

  it("safeParse rejects empty output_file", () => {
    const result = subspeciesClassificationFormSchema.safeParse({
      ...validPayload,
      output_file: "",
    });
    expect(result.success).toBe(false);
  });
});
